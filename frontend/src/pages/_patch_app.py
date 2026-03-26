# frontend/src/pages/_patch_app.py
# Запускается на хосте сервера: sudo python3 /opt/taipan/frontend/src/pages/_patch_app.py

path = '/opt/taipan/frontend/src/App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

if 'Antidoping' not in c:
    c = c.replace(
        "import Privacy from './pages/Privacy'",
        "import Privacy from './pages/Privacy'\nimport Antidoping from './pages/Antidoping'"
    )
    c = c.replace(
        '<Route path="/privacy"             element={<Privacy />} />',
        '<Route path="/privacy"             element={<Privacy />} />\n        <Route path="/antidoping"         element={<Antidoping />} />'
    )
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('App.jsx: роут /antidoping добавлен')
else:
    print('App.jsx без изменений')
