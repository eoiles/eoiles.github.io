from pathlib import Path
import json,subprocess
r=Path(__file__).resolve().parents[1]
actual=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {encode} from './src/protocol.js';console.log(JSON.stringify(['remap','native'].map(f=>Array.from({length:256},(_,n)=>encode(String.fromCharCode(n),f).charCodeAt(1)))))"],cwd=r))
weights=[1,2,4,64,8,16,32,128]
for mode,file in enumerate(['concept.py','concept-native.py']):
    source=(r/'src'/file).read_text(encoding='utf-8')
    for n in range(256):
        snippet=source.replace('{65:08b}',f'{{{n}:08b}}') if mode==0 else source.replace('字节 = 65',f'字节 = {n}')
        scope={};exec(compile(snippet,file,'exec'),scope)
        expected=10240+(sum(w for i,w in enumerate(weights) if n&(128>>i)) if mode==0 else n)
        assert ord(scope['编码'])==expected==actual[mode][n],(file,n)
        assert scope['还原']==n,(file,n)
    print(file, '256 byte mappings and inverses match independent positions and real JS core')
