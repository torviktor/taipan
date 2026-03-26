# backend/migrations/patch_models.py
import re

path = '/opt/taipan/backend/app/models/user.py'
with open(path, 'r') as f:
    content = f.read()

changed = False

if 'insurance_expiry' not in content:
    old = 'is_archived = Column(Boolean, default=False)'
    new = 'is_archived = Column(Boolean, default=False)\n    insurance_expiry = Column(Date, nullable=True)'
    if old in content:
        content = content.replace(old, new)
        changed = True
        print('insurance_expiry добавлено')
    else:
        print('WARN: is_archived не найдено в user.py')

if 'strategy_items' not in content:
    old = 'is_active = Column(Boolean, default=True)'
    new = "is_active = Column(Boolean, default=True)\n    strategy_items = Column(Text, default='[]')"
    if old in content:
        content = content.replace(old, new)
        changed = True
        print('strategy_items добавлено')
    else:
        print('WARN: is_active не найдено в user.py')

if 'Date' not in content and 'from sqlalchemy import' in content:
    content = re.sub(r'from sqlalchemy import (.*)', r'from sqlalchemy import Date, \1', content, count=1)
    changed = True
    print('Date импорт добавлен')

if changed:
    with open(path, 'w') as f:
        f.write(content)
    print('user.py обновлён')
else:
    print('user.py без изменений')
