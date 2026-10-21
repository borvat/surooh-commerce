"""Security/governance regressions: direction approval never grants write/start powers."""
import unittest,sys,json,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'ci'))
from check_shared_core import validate_authority
class Holds(unittest.TestCase):
 def setUp(self):
  d=ROOT/('docs/wms/shared-core' if (ROOT/'docs/wms/shared-core').is_dir() else 'docs/shared-core')
  self.c=json.loads((ROOT/'contracts/shared-core-authority.json').read_text());self.p=json.loads((d/'plan.json' if 'wms' in d.parts else ROOT/'planning/cross-system-plan.json').read_text());self.o=json.loads((d/'OWNER_DISPOSITION.json').read_text())
 def test_direction_only_valid(self):validate_authority(self.c,self.p,self.o)
 def test_direction_cannot_start_codex(self):
  self.o['codex_start_authorized']=True
  with self.assertRaises(AssertionError):validate_authority(self.c,self.p,self.o)
 def test_second_stock_valuation_authority_rejected(self):
  self.c['authorities']['inventory_value']='Tryton local valuation'
  with self.assertRaises(AssertionError):validate_authority(self.c,self.p,self.o)
 def test_second_reservation_writer_rejected(self):
  self.c['dual_reservation_writer_allowed']=True
  with self.assertRaises(AssertionError):validate_authority(self.c,self.p,self.o)
 def test_missing_service_boundary_rejected(self):
  self.c['company_boundary'].remove('service_identity')
  with self.assertRaises(AssertionError):validate_authority(self.c,self.p,self.o)
 def test_direction_cannot_approve_admin_change(self):
  self.o['admin_or_billing_change_authorized']=True
  with self.assertRaises(AssertionError):validate_authority(self.c,self.p,self.o)
