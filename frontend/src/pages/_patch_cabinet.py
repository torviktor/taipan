# frontend/src/pages/_patch_cabinet.py
# Запускается на хосте сервера: sudo python3 /opt/taipan/frontend/src/pages/_patch_cabinet.py

path = '/opt/taipan/frontend/src/pages/Cabinet.jsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

changed = False

# Импорты
if 'InsuranceTab' not in c:
    anchor = "import CompetitionsTab from './CompetitionsTab'"
    if anchor in c:
        c = c.replace(anchor,
            anchor
            + "\nimport InsuranceTab from './InsuranceTab'"
            + "\nimport StrategyTab  from './StrategyTab'"
            + "\nimport EquipmentTab from './EquipmentTab'"
        )
        changed = True
        print('Импорты добавлены')

# Сигнатура InfoTab
if 'function InfoTab({ isAdmin })' in c:
    c = c.replace('function InfoTab({ isAdmin })', 'function InfoTab({ isAdmin, token })')
    changed = True
    print('InfoTab: token prop добавлен')

# Кнопки в InfoTab
if 'id="insurance"' not in c:
    old = '{isAdmin && <SectionBtn id="admin" label="\u041f\u0430\u043c\u044f\u0442\u043a\u0430 \u0442\u0440\u0435\u043d\u0435\u0440\u0430"/>}'
    new = ('{isAdmin && <SectionBtn id="insurance"  label="\u0421\u0442\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u0438\u0435"/>}\n'
           '        {isAdmin && <SectionBtn id="strategy"   label="\u0421\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044f"/>}\n'
           '        {isAdmin && <SectionBtn id="equipment"  label="\u042d\u043a\u0438\u043f\u0438\u0440\u043e\u0432\u043a\u0430"/>}\n'
           '        {isAdmin && <SectionBtn id="admin"      label="\u041f\u0430\u043c\u044f\u0442\u043a\u0430 \u0442\u0440\u0435\u043d\u0435\u0440\u0430"/>}')
    if old in c:
        c = c.replace(old, new)
        changed = True
        print('Кнопки добавлены')
    else:
        print('WARN: кнопка admin не найдена — проверьте вручную')

# Рендер новых секций
if "section === 'insurance'" not in c:
    old = '{/* \u2500\u2500 \u041f\u0410\u041c\u042f\u0422\u041a\u0410 \u0422\u0420\u0415\u041d\u0415\u0420\u0410 \u2500\u2500 */}'
    new = ("      {section === 'insurance' && isAdmin && (<InsuranceTab token={token} />)}\n\n"
           "      {section === 'strategy' && isAdmin && (<StrategyTab token={token} />)}\n\n"
           "      {section === 'equipment' && isAdmin && (<EquipmentTab />)}\n\n"
           "      {/* \u2500\u2500 \u041f\u0410\u041c\u042f\u0422\u041a\u0410 \u0422\u0420\u0415\u041d\u0415\u0420\u0410 \u2500\u2500 */}")
    if old in c:
        c = c.replace(old, new)
        changed = True
        print('Рендер секций добавлен')
    else:
        print('WARN: маркер ПАМЯТКА ТРЕНЕРА не найден — проверьте вручную')

# token в InfoTab
if '<InfoTab isAdmin={true} />' in c:
    c = c.replace('<InfoTab isAdmin={true} />', '<InfoTab isAdmin={true} token={token} />')
    changed = True
if '<InfoTab isAdmin={false}/>' in c:
    c = c.replace('<InfoTab isAdmin={false}/>', '<InfoTab isAdmin={false} token={token}/>')
    changed = True

if changed:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('Cabinet.jsx сохранён')
else:
    print('Cabinet.jsx без изменений')

# Проверка баланса скобок
d = 0
for ch in c:
    if ch == '{': d += 1
    if ch == '}': d -= 1
print(f'Баланс скобок: {d}', 'OK' if d == 0 else 'ОШИБКА!')
if d != 0:
    raise SystemExit(1)
