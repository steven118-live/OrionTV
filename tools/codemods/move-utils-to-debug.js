// tools/codemods/move-utils-to-debug.js
export default function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Replace import declarations that use "@/utils/..."
  root.find(j.ImportDeclaration).forEach(path => {
    const src = path.node.source && path.node.source.value;
    if (!src || typeof src !== 'string') return;
    // change "@/utils/devLog" -> "@/debug/utils/devLog"
    if (src === '@/utils/devLog' || src === 'src/utils/devLog' || src.endsWith('/utils/devLog')) {
      path.node.source = j.stringLiteral(src.replace(/^(?:@\/|src\/)?utils\/devLog$/, '@/debug/utils/devLog'));
    }
    // optional: change "@/utils/Logger" -> "@/debug/utils/Logger"
    if (src === '@/utils/Logger' || src === 'src/utils/Logger' || src.endsWith('/utils/Logger')) {
      path.node.source = j.stringLiteral(src.replace(/^(?:@\/|src\/)?utils\/Logger$/, '@/debug/utils/Logger'));
    }
  });

  // Replace require(...) style
  root.find(j.CallExpression, { callee: { name: 'require' } }).forEach(path => {
    const arg = path.node.arguments && path.node.arguments[0];
    if (!arg || arg.type !== 'Literal' || typeof arg.value !== 'string') return;
    let v = arg.value;
    if (v === '@/utils/devLog' || v === 'src/utils/devLog' || v.endsWith('/utils/devLog')) {
      arg.value = v.replace(/^(?:@\/|src\/)?utils\/devLog$/, '@/debug/utils/devLog');
    }
    if (v === '@/utils/Logger' || v === 'src/utils/Logger' || v.endsWith('/utils/Logger')) {
      arg.value = v.replace(/^(?:@\/|src\/)?utils\/Logger$/, '@/debug/utils/Logger');
    }
  });

  return root.toSource({ quote: 'single' });
}