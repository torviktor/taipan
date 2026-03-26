# backend/migrations/patch_main.py
path = '/app/app/main.py'
with open(path, 'r') as f:
    content = f.read()

changed = False

if 'insurance_strategy' not in content:
    old = 'from app.routes.hall_of_fame_routes import router as hof_router'
    new = (old
        + '\nfrom app.routes.insurance_strategy import router as insurance_strategy_router'
        + '\nfrom app.routes.analytics import router as analytics_router')
    content = content.replace(old, new)

    old2 = 'app.include_router(hof_router'
    new2 = ('app.include_router(insurance_strategy_router, prefix="/api", tags=["Страховка и стратегия"])\n'
            'app.include_router(analytics_router,          prefix="/api", tags=["Аналитика"])\n'
            + old2)
    content = content.replace(old2, new2)
    changed = True
    print('main.py обновлён')
else:
    print('main.py без изменений')

if changed:
    with open(path, 'w') as f:
        f.write(content)
