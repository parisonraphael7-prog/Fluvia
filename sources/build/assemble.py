"""src/ → site/index.html (données chargées depuis data/) et dist/index.html (autonome, données intégrées)."""
import pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src"
css, body, js = (src / "style.css").read_text(), (src / "body.html").read_text(), (src / "app.js").read_text()
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800&family=Rubik:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap">'
DESC = "Un jeu de cartes à collectionner : 122 rivières du Grand Est et 6 phénomènes, tirés des données du concours DataGrandEst 2026. Boosters à déchirer, album, duels."
ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='12' y='4' width='40' height='56' rx='5' fill='%230b0d24' stroke='%23ffcf4a' stroke-width='3'/%3E%3Cpath d='M22 46c6-4 4-12 10-16s10-6 10-14' stroke='%2319d3ff' stroke-width='4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"
# version artifact (le cadre ajoute doctype/head)
(root / "site" / "index.html").write_text(f'<meta charset="utf-8">\n<title>Fluvia</title>\n<meta name="description" content="{DESC}">\n{FONTS}\n<style>\n{css}\n</style>\n{body}\n<script type="module">\n{js}\n</script>\n')
# version autonome
data = (root / "site" / "data" / "cards.json").read_text().replace("</", "<\\/")
dist = root / "dist"; dist.mkdir(exist_ok=True)
(dist / "index.html").write_text(f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Fluvia</title>
<meta name="description" content="{DESC}">
<meta name="author" content="Raphaël Parison">
<meta name="theme-color" content="#0b0d24">
<meta property="og:title" content="Fluvia">
<meta property="og:description" content="{DESC}">
<meta property="og:image" content="https://parisonraphael7-prog.github.io/Fluvia/apercu.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{ICON}">
{FONTS}
<style>
{css}
</style>
</head>
<body>
{body}
<script type="application/json" id="data-cards">{data}</script>
<script type="module">
{js}
</script>
</body>
</html>
""")
print("ok", round((dist / "index.html").stat().st_size / 1e6, 2), "Mo (autonome)")
# --publish : copie la version autonome à la racine du dépôt GitHub (le site en ligne)
if "--publish" in sys.argv:
    target = root.parent / "index.html"
    target.write_text((dist / "index.html").read_text())
    print("publié →", target)
