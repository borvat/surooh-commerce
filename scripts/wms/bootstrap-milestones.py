#!/usr/bin/env python3
"""Reviewable metadata-only bootstrap. Dry-run default; never launches agents or CI."""
import argparse
import json
import pathlib
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
REPO = 'borvat/surooh-commerce'


def api(method, endpoint, payload=None):
    command = ['gh', 'api', '--method', method, endpoint]
    if payload is not None:
        command += ['--input', '-']
    result = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                            capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Create native milestones and attach existing phase Issues only')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'docs/wms/phases.json').read_text())
    register = json.loads((ROOT / 'docs/wms/github-register.json').read_text())
    numbers = {row['phase']: row['number'] for row in register['phase_issues']}
    plan = [{'phase': p['id'], 'milestone': p['milestone'], 'issue': numbers[p['id']]} for p in catalog['phases']]
    if not args.apply:
        print(json.dumps({'mode': 'DRY_RUN', 'repository': REPO, 'operations': plan,
                          'starts_codex': False, 'changes_main': False, 'deploys': False}, indent=2))
        return
    if not shutil.which('gh'):
        raise SystemExit('BLOCKED: authenticated GitHub CLI unavailable; no remote mutation performed.')
    milestones = []
    page = 1
    while True:
        batch = api('GET', f'repos/{REPO}/milestones?state=all&per_page=100&page={page}')
        milestones.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    by_title = {m['title']: m for m in milestones}
    for item in plan:
        milestone = by_title.get(item['milestone'])
        if milestone is None:
            milestone = api('POST', f'repos/{REPO}/milestones', {
                'title': item['milestone'], 'state': 'open',
                'description': f"{item['phase']} planning milestone. Execution held; owner-controlled phase review. No automatic Codex assignment, main merge or deployment."})
            by_title[item['milestone']] = milestone
        api('PATCH', f'repos/{REPO}/issues/{item["issue"]}', {'milestone': milestone['number']})
        print(json.dumps({'phase': item['phase'], 'milestone_number': milestone['number'],
                          'issue_number': item['issue'], 'url': milestone['html_url']}))


if __name__ == '__main__':
    main()
