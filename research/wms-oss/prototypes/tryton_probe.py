"""Synthetic probes against installed Tryton ORM; no Surooh or external connection."""
from decimal import Decimal
from trytond.pool import Pool
from trytond.tests.test_tryton import ModuleTestCase, with_transaction
from trytond.modules.company.tests import create_company, set_company

class SuroohStockProbe(ModuleTestCase):
    module = 'stock'

    @with_transaction()
    def test_shared_component_cancel_and_dispatch(self):
        p = Pool()
        Move, Location = p.get('stock.move'), p.get('stock.location')
        Template, Product, Uom = p.get('product.template'), p.get('product.product'), p.get('product.uom')
        unit, = Uom.search([('name', '=', 'Meter')])
        template = Template(name='SYNTHETIC shared component', type='goods', default_uom=unit)
        template.save()
        product = Product(template=template.id)
        product.save()
        supplier, = Location.search([('code', '=', 'SUP')])
        storage, = Location.search([('code', '=', 'STO')])
        customer, = Location.search([('code', '=', 'CUS')])
        company = create_company()
        with set_company(company):
            def move(qty, origin, destination):
                return Move.create([dict(product=product.id, unit=unit.id, quantity=qty,
                    from_location=origin.id, to_location=destination.id, company=company.id,
                    unit_price=Decimal(1), currency=company.currency.id)])[0]
            receipt = move(10, supplier, storage)
            Move.do([receipt])
            # These quantities are explicitly expanded by the probe, NOT a native kit resolver.
            first = move(6, storage, customer)
            self.assertTrue(Move.assign_try([first]))
            second = move(6, storage, customer)
            self.assertFalse(Move.assign_try([second]))
            assigned = Move.search([('product', '=', product.id), ('state', '=', 'assigned')])
            self.assertEqual(sum(m.quantity for m in assigned), 10)
            Move.cancel(assigned)
            third = move(10, storage, customer)
            self.assertTrue(Move.assign_try([third]))
            Move.do([third])
            self.assertEqual(Move(third.id).state, 'done')
            empty = move(1, storage, customer)
            self.assertFalse(Move.assign_try([empty]))

    @with_transaction()
    def test_company_stock_quantity_scope(self):
        p = Pool()
        Move, Location = p.get('stock.move'), p.get('stock.location')
        Template, Product, Uom = p.get('product.template'), p.get('product.product'), p.get('product.uom')
        unit, = Uom.search([('name', '=', 'Meter')])
        template = Template(name='SYNTHETIC shared catalog', type='goods', default_uom=unit)
        template.save()
        product = Product(template=template.id)
        product.save()
        supplier, = Location.search([('code', '=', 'SUP')])
        storage, = Location.search([('code', '=', 'STO')])
        a, b = create_company(), create_company()
        with set_company(a):
            receipt, = Move.create([dict(product=product.id, unit=unit.id, quantity=7,
                from_location=supplier.id, to_location=storage.id, company=a.id,
                unit_price=Decimal(1), currency=a.currency.id)])
            Move.do([receipt])
            self.assertEqual(Product.products_by_location([storage.id]).get((storage.id, product.id)), 7)
        with set_company(b):
            self.assertEqual(Product.products_by_location([storage.id]).get((storage.id, product.id), 0), 0)
        # Company context check is NOT a limited-user API/RLS penetration test.

class SuroohKitAvailabilityProbe(ModuleTestCase):
    module = 'product_kit'
    extras = ['stock']

    @with_transaction()
    def test_two_native_kits_share_one_component(self):
        p = Pool()
        Template, Product = p.get('product.template'), p.get('product.product')
        Component, Uom = p.get('product.component'), p.get('product.uom')
        Move, Location = p.get('stock.move'), p.get('stock.location')
        unit, = Uom.search([('name', '=', 'Unit')])
        def product(name, kind):
            template = Template(name='SYNTHETIC ' + name, type=kind, default_uom=unit)
            template.save()
            result = Product(template=template.id)
            result.save()
            return result
        shared = product('component', 'goods')
        kits = [product('kit A', 'kit'), product('kit B', 'kit')]
        for kit, quantity in zip(kits, [4, 6]):
            Component.create([dict(parent_product=kit.id, parent_template=kit.template.id, product=shared.id,
                quantity=quantity, unit=unit.id)])
        supplier, = Location.search([('code', '=', 'SUP')])
        storage, = Location.search([('code', '=', 'STO')])
        company = create_company()
        with set_company(company):
            receipt, = Move.create([dict(product=shared.id, unit=unit.id, quantity=10,
                from_location=supplier.id, to_location=storage.id, company=company.id,
                unit_price=Decimal(1), currency=company.currency.id)])
            Move.do([receipt])
            from trytond.transaction import Transaction
            with Transaction().set_context(locations=[storage.id]):
                a, b = Product(kits[0].id), Product(kits[1].id)
                self.assertEqual((a.quantity, b.quantity), (2, 1))
                self.assertEqual(Product(shared.id).quantity, 10)
                # Independent offer ATP 2 and 1 cannot be sold as three disjoint kits:
                self.assertGreater(2 * 4 + 1 * 6, 10)
        # Atomic cross-channel kit reservations remain a separate PostgreSQL gate.
