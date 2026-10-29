import pypdf, os

out = []
files = [
    'c:/Users/ayush/Downloads/1.pdf',
    'c:/Users/ayush/Downloads/2.pdf',
    'c:/Users/ayush/Downloads/3.pdf',
    'c:/Users/ayush/Downloads/4.pdf',
]
for f in files:
    out.append('\n\n===== FILE: ' + f + ' =====\n')
    r = pypdf.PdfReader(f)
    for i, p in enumerate(r.pages):
        out.append('--- page %d ---\n' % (i + 1))
        out.append(p.extract_text() or '')
open('d:/Swasthya/blueprint.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('done', os.path.getsize('d:/Swasthya/blueprint.txt'))
