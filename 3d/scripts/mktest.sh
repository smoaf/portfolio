#!/bin/bash
# usage: mktest.sh model.glb out.html  -> test page that loads the model, UI hidden
python3 -c "
import base64,gzip;b=base64.b64encode(gzip.compress(open('$1','rb').read(),9,mtime=0)).decode()
open('${1%.glb}.js','w').write('window.MODULE_GLB_GZ=\"'+b+'\";\n')"
(echo '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; sed -e 's#https://cdn.jsdelivr.net/npm/three@0.160.0/#/node_modules/three/#g' -e "s#arrangement_v7.js#${1%.glb}.js#" viewer.html) > $2
sed -i 's#</style>#.label,.controls,.hint{display:none!important}</style>#' $2
