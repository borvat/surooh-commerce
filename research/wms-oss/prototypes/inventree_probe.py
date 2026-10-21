"""Synthetic native InvenTree API/model probes; no production configuration."""
from InvenTree.unit_test import InvenTreeAPITestCase
from company.models import Company
from part.models import Part, BomItem
from stock.models import StockItem
from order.models import SalesOrder, SalesOrderLineItem
from order.serializers import SalesOrderShipmentAllocationSerializer
from rest_framework.exceptions import ValidationError
from django.core.exceptions import ValidationError as DjangoValidationError

class SuroohInventoryProbe(InvenTreeAPITestCase):
    roles = ['part.view', 'sales_order.add']
    fixtures = ['users']

    def test_shared_bom_is_not_virtual_sales_reservation(self):
        component = Part.objects.create(name='SYNTHETIC component', component=True)
        kits = [Part.objects.create(name='SYNTHETIC kit ' + s, assembly=True, salable=True) for s in ['A','B']]
        for kit in kits:
            BomItem.objects.create(part=kit, sub_part=component, quantity=6)
        stock = StockItem.objects.create(part=component, quantity=10)
        customer = Company.objects.create(name='SYNTHETIC buyer', is_customer=True)
        order = SalesOrder.objects.create(customer=customer, reference='SO-SYNTHETIC')
        line = SalesOrderLineItem.objects.create(order=order, part=kits[0], quantity=1)
        serializer = SalesOrderShipmentAllocationSerializer(data={'items': [dict(
            line_item=line.pk, stock_item=stock.pk, quantity=6)]}, context={'order': order})
        # A sales line for a parent kit cannot allocate child stock automatically.
        # Validation may occur in is_valid or save; either must reject this mismatch.
        with self.assertRaises((ValidationError, DjangoValidationError)):
            serializer.is_valid(raise_exception=True)
            serializer.save()
        stock.refresh_from_db()
        self.assertEqual(stock.quantity, 10)

    def test_company_records_do_not_scope_part_api(self):
        Company.objects.create(name='SYNTHETIC company A', is_customer=True)
        Company.objects.create(name='SYNTHETIC company B', is_customer=True)
        a = Part.objects.create(name='SYNTHETIC catalog A')
        b = Part.objects.create(name='SYNTHETIC catalog B')
        for part in [a,b]:
            self.get(f'/api/part/{part.pk}/', expected_code=200)
        fields = {f.name for f in Part._meta.fields}
        self.assertNotIn('organization', fields)
        self.assertNotIn('company', fields)
        # This is an architecture gap for shared-instance tenants, not an auth bypass claim.
