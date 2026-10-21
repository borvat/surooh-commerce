"""Offline shared architecture/evidence consistency only. Never native CI or permission."""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def validate_authority(c,p,o):
 assert c['architecture_id']=='SUROOH-SHARED-CORE-001'
 assert c['direction_status']==o['direction_status']=='APPROVED_PREPARATION_ONLY'
 for k in ['direct_ui_engine_write_authorized','dual_financial_ledger_allowed','dual_inventory_valuation_allowed','dual_reservation_writer_allowed','bol_writes_authorized','execution_authorized','main_merge_authorized','production_deploy_authorized','real_data_migration_authorized']:assert c[k] is False,k
 for k in ['production_adoption','codex_start_authorized','merge_authorized','production_deploy_authorized','real_data_migration_authorized','admin_or_billing_change_authorized']:assert o[k] is False,k
 assert set(c['company_boundary'])=={'site','database','storage','service_identity'}
 expected={'physical_quantity':'ERPNext.Stock Ledger Entry','warehouse_movements':'ERPNext native stock documents','reservations':'ERPNext.Stock Reservation Entry','inventory_value':'ERPNext native valuation','cogs':'ERPNext native valuation and GL','financial_ledger':'ERPNext.GL Entry'}
 for k,v in expected.items():assert c['authorities'][k]==v,k
 assert p['execution_authorized'] is False and p['production_authority_changed'] is False
 assert [w['id'] for w in p['waves']]==['C'+str(i) for i in range(6)]
 for i,w in enumerate(p['waves']):assert w['depends_on']==([] if i==0 else ['C'+str(i-1)])

def check(root=ROOT):
 wms=(root/'docs/wms/shared-core').is_dir();d=root/('docs/wms/shared-core' if wms else 'docs/shared-core')
 c=json.loads((root/'contracts/shared-core-authority.json').read_text());p=json.loads((d/'plan.json' if wms else root/'planning/cross-system-plan.json').read_text());o=json.loads((d/'OWNER_DISPOSITION.json').read_text());validate_authority(c,p,o)
 assert hashlib.sha256((root/'contracts/shared-core-authority.json').read_bytes()).hexdigest()==p['authority_sha256']
 m=json.loads((d/'manifest.json').read_text())
 for row in m['files']:
  path=(root/row['path']).resolve();assert path.is_relative_to(root.resolve())
  assert hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256'],row['path']
 if wms:
  phases=json.loads((root/'docs/wms/phases.json').read_text());assert phases['execution_authorized'] is False and phases['active_phase'] is None
  assert phases['architecture_decision']['direction_status']=='APPROVED_PREPARATION_ONLY'
  assert phases['architecture_decision']['status']=='proposed' and phases['architecture_decision']['owner_acceptance_ref'] is None
  assert [x['id'] for x in phases['phases']]==['P'+str(i).zfill(2) for i in range(1,10)]
 else:
  phases=json.loads((root/'planning/stages.json').read_text());assert phases['independent_evaluation']['decision_approval'] is None
  for k in ['codex_start_authorized','main_merge_authorized','production_deploy_authorized','real_data_migration_authorized']:assert phases[k] is False
  for name,n in [('native-results.json',8),('isolation-results.json',11)]:
   j=json.loads((d/'evidence'/name).read_text());assert len(j['cases'])==n and all(x['status']=='PASS' for x in j['cases'])
 return {'status':'PASS','proof':'offline contract and captured hash consistency only','hosted_native_ci':'NOT_PROVEN','direction':'APPROVED_PREPARATION_ONLY','codex':'HELD'}
if __name__=='__main__':print(json.dumps(check(),indent=2))
