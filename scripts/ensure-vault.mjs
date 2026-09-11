// A fresh public checkout builds without installing any private project data.
import {writeFile} from 'node:fs/promises';
try{await writeFile('lib/private-vault.generated.ts','export const vault: string = "";\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
