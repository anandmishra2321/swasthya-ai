import pypdf, os

out = []
f = 'c:/Users/ayush/Downloads/Swasthya_AI_Complete_Feature_Blueprint.pdf'
r = pypdf.PdfReader(f)
for i, p in enumerate(r.pages):
    out.append('--- page %d ---\n' % (i + 1))
    out.append(p.extract_text() or '')
open('d:/Swasthya/blueprint2.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('done', os.path.getsize('d:/Swasthya/blueprint2.txt'), 'pages', len(r.pages))
