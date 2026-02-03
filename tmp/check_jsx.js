const fs=require('fs');
const parser=require('@babel/parser');
const s=fs.readFileSync('frontend/src/pages/PlatformTenantDetail.jsx','utf8');
let ast;
try{
  ast=parser.parse(s,{sourceType:'module',plugins:['jsx']});
}catch(e){
  console.error('parse error',e.message);
  process.exit(1);
}
const jsxNodes=[];
function walk(node){
  if(!node) return;
  if(node.type==='JSXElement'){
    jsxNodes.push(node);
  }
  for(const k of Object.keys(node)){
    const v=node[k];
    if(Array.isArray(v)) v.forEach(walk);
    else if(v && typeof v==='object') walk(v);
  }
}
walk(ast);
jsxNodes.forEach(n=>{
  const opening = n.openingElement && n.openingElement.name && (n.openingElement.name.name || (n.openingElement.name.object && n.openingElement.name.object.name))
  const closing = n.closingElement && n.closingElement.name && (n.closingElement.name.name || (n.closingElement.name.object && n.closingElement.name.object.name))
  if(!n.closingElement && !n.openingElement.selfClosing){
    const locStart=n.openingElement.loc.start;
    console.log('Unclosed JSXElement',opening,'at',locStart.line,locStart.column)
  }
});
