"""Native JSON-RPC boundary probes. SQLite run is partial evidence only."""
from base64 import b64encode
from decimal import Decimal
import json
from trytond.tests.test_tryton import RouteTestCase
from trytond.pool import Pool
from trytond.transaction import Transaction
from trytond.modules.company.tests import create_company

class SuroohRestrictedRPC(RouteTestCase):
    module = 'stock'

    @classmethod
    def setUpDatabase(cls):
        p = Pool()
        User, Data = p.get('res.user'), p.get('ir.model.data')
        cls.companies = [create_company('SYNTHETIC A'), create_company('SYNTHETIC B')]
        group = Data.get_id('stock', 'group_stock')
        cls.users = User.create([dict(name='SYNTHETIC ' + suffix, login='synthetic_' + suffix,
            password='SyntheticOnly-2026!', company=c.id, companies=[('add',[c.id])],
            groups=[('add',[group])]) for suffix,c in zip(['a','b'],cls.companies)])
        Uom, Template, Product = p.get('product.uom'), p.get('product.template'), p.get('product.product')
        Location, Move = p.get('stock.location'), p.get('stock.move')
        unit, = Uom.search([('name','=','Unit')])
        template = Template(name='SYNTHETIC shared catalog', type='goods', default_uom=unit)
        template.save()
        product = Product(template=template.id)
        product.save()
        supplier, = Location.search([('code','=','SUP')])
        storage, = Location.search([('code','=','STO')])
        cls.storage_id = storage.id
        moves = Move.create([dict(product=product.id,unit=unit.id,quantity=qty,
            from_location=supplier.id,to_location=storage.id,company=c.id,
            unit_price=Decimal(1),currency=c.currency.id) for c,qty in zip(cls.companies,[7,99])])
        Move.do(moves)
        cls.move_ids = [m.id for m in moves]
        cls.company_ids = [c.id for c in cls.companies]
        cls.user_ids = [u.id for u in cls.users]

    def rpc(self, suffix, method, params):
        auth = b64encode(('synthetic_' + suffix + ':SyntheticOnly-2026!').encode()).decode()
        response = self.client().post(f'/{self.db_name}/rpc/',
            json=dict(id=1,method=method,params=params),headers={'Authorization':'Basic '+auth})
        try:
            body=json.loads(response.get_data(as_text=True))
        except ValueError:
            body={}
        return response.status_code, body

    def test_rpc_list_and_forged_context(self):
        for i,suffix in enumerate(['a','b']):
            for context in [{}, {'company':self.company_ids[1-i], '_companies':[self.company_ids[1-i]]}]:
                status,body=self.rpc(suffix,'model.stock.move.search',[[],0,None,None,context])
                self.assertEqual(status,200,body)
                self.assertEqual(body.get('result'),[self.move_ids[i]],body)

    def test_rpc_direct_foreign_read_and_export(self):
        for i,suffix in enumerate(['a','b']):
            own,foreign=self.move_ids[i],self.move_ids[1-i]
            for method in ['read','export_data']:
                status,body=self.rpc(suffix,'model.stock.move.'+method,[[own],['quantity'],{}])
                self.assertEqual(status,200,body)
                self.assertIn('result',body)
                status,body=self.rpc(suffix,'model.stock.move.'+method,[[foreign],['quantity'],{}])
                self.assertTrue(status>=400 or 'error' in body,(status,body))

    def test_rpc_inventory_report_company_scope(self):
        for i,suffix in enumerate(['a','b']):
            for company in self.company_ids:
                context=dict(company=company,location=self.storage_id,product_type='product.product')
                status,body=self.rpc(suffix,'model.stock.reporting.inventory.search_read',
                    [[],0,None,None,['company','quantity'],context])
                self.assertEqual(status,200,body)
                rows=body.get('result')
                self.assertIsInstance(rows,list,body)
                self.assertTrue(all(row['company']==self.company_ids[i] for row in rows),body)
                if company==self.company_ids[i]:
                    self.assertEqual([row['quantity'] for row in rows],[7 if i==0 else 99],body)

    def test_restricted_background_context_discovery(self):
        # Real separate server transaction, not a queue daemon proof. Native trusted
        # server code must explicitly enable access checks before handling delegated input.
        with Transaction().start(self.db_name,self.user_ids[0],readonly=True) as transaction:
            with transaction.set_context(_check_access=True):
                rows=Pool().get('stock.move').search([])
                self.assertEqual([r.id for r in rows],[self.move_ids[0]])

    def test_native_queue_trusted_context_requires_explicit_access_checks(self):
        from unittest.mock import patch
        with Transaction().start(self.db_name,0) as transaction:
            p=Pool()
            Move,Queue=p.get('stock.move'),p.get('ir.queue')
            captured=[]
            original=Move.export_data
            def observe(*args,**kwargs):
                rows=original(*args,**kwargs)
                captured.extend(rows)
                return rows
            task=Queue.push('synthetic-trusted-worker',dict(model='stock.move',
                method='export_data',user=self.user_ids[0],context={},
                instances=[self.move_ids[1]],args=[['quantity']],kwargs={}))
            with patch.object(Move,'export_data',side_effect=observe):
                Queue(task).run()
            self.assertEqual(captured,[[99.0]])
            transaction.rollback()
        # A trusted-server context is not a safe boundary for delegated Surooh jobs.
        # This is a discovery assertion, not a tenant acceptance success.

    def test_native_queue_checked_context_excludes_foreign_move(self):
        from unittest.mock import patch
        with Transaction().start(self.db_name,0) as transaction:
            p=Pool()
            Move,Queue=p.get('stock.move'),p.get('ir.queue')
            task=Queue.push('synthetic-checked-worker',dict(model='stock.move',
                method='export_data',user=self.user_ids[0],context={'_check_access':True},
                instances=[self.move_ids[1]],args=[['quantity']],kwargs={}))
            with patch.object(Move,'export_data',wraps=Move.export_data) as observed:
                Queue(task).run()
                observed.assert_not_called()
            transaction.rollback()
