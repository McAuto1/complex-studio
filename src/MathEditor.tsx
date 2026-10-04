import React, { useState, useEffect, KeyboardEvent, ReactNode, useRef } from 'react';
import { all, create, MathNode } from 'mathjs';

const math = create(all, { predictable: true });

function uid() { return Math.random().toString(36).slice(2, 8); }

type EditorItem = 
  | { type: 'char'; char: string; id: string }
  | { type: 'frac'; num: EditorItem[]; den: EditorItem[]; id: string }
  | { type: 'sup'; exp: EditorItem[]; id: string }
  | { type: 'sqrt'; arg: EditorItem[]; id: string }
  | { type: 'func'; name: string; arg: EditorItem[]; closed?: boolean; id: string };

type CursorState = {
  path: { id: string; field: 'num' | 'den' | 'exp' | 'arg' }[];
  offset: number;
};

function parseToEditor(str: string, isStatic = false): EditorItem[] {
  if (!str || str.trim() === '') return [];
  try {
    const ast = math.parse(str);
    return astToEditor(ast, isStatic);
  } catch {
    return str.split('').map(c => ({ type: 'char', char: c, id: uid() }));
  }
}

function astToEditor(node: MathNode, isStatic = false): EditorItem[] {
  const n = node as any;
  if (n.type === 'ConstantNode') return String(n.value).split('').map(c => ({ type: 'char', char: c, id: uid() }));
  if (n.type === 'SymbolNode') {
    const name = String(n.name);
    const display = isStatic && name === 'pi' ? 'π' : name;
    return display.split('').map(c => ({ type: 'char', char: c, id: uid() }));
  }
  if (n.type === 'ParenthesisNode') return [{ type: 'char', char: '(', id: uid() }, ...astToEditor(n.content, isStatic), { type: 'char', char: ')', id: uid() }];
  if (n.type === 'OperatorNode') {
    if (n.op === '^') return [...astToEditor(n.args[0], isStatic), { type: 'sup', exp: astToEditor(n.args[1], isStatic), id: uid() }];
    if (n.op === '/') return [{ type: 'frac', num: astToEditor(n.args[0], isStatic), den: astToEditor(n.args[1], isStatic), id: uid() }];
    if (n.args.length === 1) return [{ type: 'char', char: n.op, id: uid() }, ...astToEditor(n.args[0], isStatic)];
    return [...astToEditor(n.args[0], isStatic), { type: 'char', char: n.op, id: uid() }, ...astToEditor(n.args[1], isStatic)];
  }
  if (n.type === 'FunctionNode') {
    const name = n.fn.name || n.fn.toString();
    if (name === 'sqrt' && n.args.length === 1) {
      return [{ type: 'sqrt', arg: astToEditor(n.args[0], isStatic), id: uid() }];
    }
    if (['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'exp', 'gamma', 'Gamma', 'zeta'].includes(name) && n.args.length === 1) {
      const displayName = name === 'gamma' || name === 'Gamma' ? (isStatic ? 'Γ' : 'gamma') : name === 'zeta' ? (isStatic ? 'ζ' : 'zeta') : name;
      return [{ type: 'func', name: displayName, arg: astToEditor(n.args[0], isStatic), closed: true, id: uid() }];
    }
    const displayName = isStatic && (name === 'gamma' || name === 'Gamma') ? 'Γ' : (isStatic && name === 'zeta' ? 'ζ' : name);
    const res: EditorItem[] = displayName.split('').map((c: string) => ({ type: 'char', char: c, id: uid() }));
    res.push({ type: 'char', char: '(', id: uid() });
    for (let i = 0; i < n.args.length; i++) {
      if (i > 0) res.push({ type: 'char', char: ',', id: uid() });
      res.push(...astToEditor(n.args[i], isStatic));
    }
    res.push({ type: 'char', char: ')', id: uid() });
    return res;
  }
  return n.toString().split('').map((c: string) => ({ type: 'char', char: c, id: uid() }));
}

function serializeEditor(items: EditorItem[]): string {
  let str = '';
  for (const item of items) {
    if (item.type === 'char') str += item.char;
    else if (item.type === 'frac') str += `(${serializeEditor(item.num)})/(${serializeEditor(item.den)})`;
    else if (item.type === 'sup') str += `^(${serializeEditor(item.exp)})`;
    else if (item.type === 'sqrt') str += `sqrt(${serializeEditor(item.arg)})`;
    else if (item.type === 'func') {
      const fnName = item.name === 'Γ' ? 'gamma' : item.name;
      str += `${fnName}(${serializeEditor(item.arg)})`;
    }
  }
  return str;
}

function cloneDeep(items: EditorItem[]): EditorItem[] {
  return items.map(item => {
    if (item.type === 'frac') return { ...item, num: cloneDeep(item.num), den: cloneDeep(item.den) };
    if (item.type === 'sup') return { ...item, exp: cloneDeep(item.exp) };
    if (item.type === 'sqrt') return { ...item, arg: cloneDeep(item.arg) };
    if (item.type === 'func') return { ...item, arg: cloneDeep(item.arg), closed: item.closed };
    return { ...item };
  });
}

function getTargetArray(root: EditorItem[], path: CursorState['path']): EditorItem[] {
  let current = root;
  for (const step of path) {
    const item = current.find(i => i.id === step.id);
    if (!item) return current;
    if (item.type === 'frac') current = step.field === 'num' ? item.num : item.den;
    else if (item.type === 'sup') current = item.exp;
    else if (item.type === 'sqrt' || item.type === 'func') current = item.arg;
  }
  return current;
}

export function MathStatic({ expression }: { expression: string }) {
  const items = parseToEditor(expression, true);
  const renderStatic = (nodeItems: EditorItem[]): ReactNode[] => {
    const nodes: ReactNode[] = [];
    for (let i = 0; i < nodeItems.length; i++) {
      const item = nodeItems[i];
      if (item.type === 'char') {
        const isOp = ['+', '-', '*', '/', '=', '(', ')', ','].includes(item.char);
        const Cmp = isOp ? 'mo' : 'mi';
        nodes.push(<Cmp key={item.id}>{item.char === '*' ? '·' : item.char}</Cmp>);
      } else if (item.type === 'frac') {
        nodes.push(<mfrac key={item.id}><mrow>{renderStatic(item.num)}</mrow><mrow>{renderStatic(item.den)}</mrow></mfrac>);
      } else if (item.type === 'sup') {
        const prev = nodes.pop();
        nodes.push(<msup key={item.id}><mrow>{prev}</mrow><mrow>{renderStatic(item.exp)}</mrow></msup>);
      } else if (item.type === 'sqrt') {
        nodes.push(<msqrt key={item.id}><mrow className="sqrt-radicand">{renderStatic(item.arg)}</mrow></msqrt>);
      } else if (item.type === 'func') {
        nodes.push(<React.Fragment key={item.id}><mi>{item.name}</mi><mo>(</mo><mrow>{renderStatic(item.arg)}</mrow><mo>)</mo></React.Fragment>);
      }
    }
    return nodes;
  };
  return <math>{renderStatic(items)}</math>;
}

export function MathEditor({ value, onChange, onEnter }: { value: string; onChange: (val: string) => void; onEnter: () => void }) {
  const [items, setItems] = useState<EditorItem[]>(() => parseToEditor(value));
  const [cursor, setCursor] = useState<CursorState>({ path: [], offset: items.length });
  const [focused, setFocused] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardTab, setKeyboardTab] = useState<'calculator' | 'functions'>('calculator');
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPropValue = useRef<string>(value);
  const lastSentValue = useRef<string>(value);

  useEffect(() => {
    if (value === lastSentValue.current) {
      lastPropValue.current = value;
      return;
    }
    if (value === lastPropValue.current) {
      return;
    }
    const parsed = parseToEditor(value);
    setItems(parsed);
    setCursor({ path: [], offset: parsed.length });
    lastPropValue.current = value;
    lastSentValue.current = value;
  }, [value]);

  const updateItems = (newItems: EditorItem[], newCursor: CursorState) => {
    setItems(newItems);
    setCursor(newCursor);
    const serialized = serializeEditor(newItems);
    lastSentValue.current = serialized;
    onChange(serialized);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEnter();
      e.preventDefault();
      return;
    }
    
    if (e.key === 'ArrowLeft') {
      if (cursor.offset > 0) {
        const arr = getTargetArray(items, cursor.path);
        const leftItem = arr[cursor.offset - 1];
        if (leftItem.type === 'sup') setCursor({ path: [...cursor.path, { id: leftItem.id, field: 'exp' }], offset: leftItem.exp.length });
        else if (leftItem.type === 'frac') setCursor({ path: [...cursor.path, { id: leftItem.id, field: 'den' }], offset: leftItem.den.length });
        else if (leftItem.type === 'sqrt' || leftItem.type === 'func') setCursor({ path: [...cursor.path, { id: leftItem.id, field: 'arg' }], offset: leftItem.arg.length });
        else setCursor({ ...cursor, offset: cursor.offset - 1 });
      } else if (cursor.path.length > 0) {
        const last = cursor.path[cursor.path.length - 1];
        if (last.field === 'den') {
          const fracNode = getTargetArray(items, cursor.path.slice(0, -1)).find(i => i.id === last.id) as any;
          setCursor({ path: [...cursor.path.slice(0, -1), { id: last.id, field: 'num' }], offset: fracNode ? fracNode.num.length : 0 });
        } else {
          const newPath = cursor.path.slice(0, -1);
          const parentArr = getTargetArray(items, newPath);
          setCursor({ path: newPath, offset: parentArr.findIndex(i => i.id === last.id) });
        }
      }
    } else if (e.key === 'ArrowRight') {
      const arr = getTargetArray(items, cursor.path);
      if (cursor.offset < arr.length) {
        const nextItem = arr[cursor.offset];
        if (nextItem.type === 'sup') setCursor({ path: [...cursor.path, { id: nextItem.id, field: 'exp' }], offset: 0 });
        else if (nextItem.type === 'frac') setCursor({ path: [...cursor.path, { id: nextItem.id, field: 'num' }], offset: 0 });
        else if (nextItem.type === 'sqrt' || nextItem.type === 'func') setCursor({ path: [...cursor.path, { id: nextItem.id, field: 'arg' }], offset: 0 });
        else setCursor({ ...cursor, offset: cursor.offset + 1 });
      } else if (cursor.path.length > 0) {
        const last = cursor.path[cursor.path.length - 1];
        if (last.field === 'num') {
          setCursor({ path: [...cursor.path.slice(0, -1), { id: last.id, field: 'den' }], offset: 0 });
        } else {
          const newPath = cursor.path.slice(0, -1);
          const parentArr = getTargetArray(items, newPath);
          setCursor({ path: newPath, offset: parentArr.findIndex(i => i.id === last.id) + 1 });
        }
      }
    } else if (e.key === 'Backspace') {
      executeCommand('Backspace');
      e.preventDefault();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      executeCommand(e.key);
      e.preventDefault();
    }
  };

  const executeCommand = (cmd: string) => {
    if (!focused && document.activeElement !== containerRef.current) {
      containerRef.current?.focus();
    }
    
    if (cmd === '^') {
      const newItems = cloneDeep(items);
      const arr = getTargetArray(newItems, cursor.path);
      const supId = uid();
      arr.splice(cursor.offset, 0, { type: 'sup', exp: [], id: supId });
      updateItems(newItems, { path: [...cursor.path, { id: supId, field: 'exp' }], offset: 0 });
    } else if (cmd === 'sqrt') {
      const newItems = cloneDeep(items);
      const arr = getTargetArray(newItems, cursor.path);
      const sqId = uid();
      arr.splice(cursor.offset, 0, { type: 'sqrt', arg: [], id: sqId });
      updateItems(newItems, { path: [...cursor.path, { id: sqId, field: 'arg' }], offset: 0 });
    } else if (['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'exp', 'gamma'].includes(cmd)) {
      const newItems = cloneDeep(items);
      const arr = getTargetArray(newItems, cursor.path);
      const funcId = uid();
      arr.splice(cursor.offset, 0, { type: 'func', name: cmd, arg: [], closed: false, id: funcId });
      updateItems(newItems, { path: [...cursor.path, { id: funcId, field: 'arg' }], offset: 0 });
    } else if (cmd === 'frac') {
      const newItems = cloneDeep(items);
      const arr = getTargetArray(newItems, cursor.path);
      let i = cursor.offset - 1;
      let parens = 0;
      while (i >= 0) {
        const item = arr[i];
        if (item.type === 'char') {
          if (item.char === ')') parens++;
          else if (item.char === '(') parens--;
          if (parens === 0 && ['+', '-', '*', '=', '<', '>', ','].includes(item.char)) break;
          else if (parens < 0) break;
        }
        i--;
      }
      const startIndex = i + 1;
      const numItems = arr.splice(startIndex, cursor.offset - startIndex);
      if (numItems.length === 0) numItems.push({ type: 'char', char: '1', id: uid() });
      const fracId = uid();
      arr.splice(startIndex, 0, { type: 'frac', num: numItems, den: [], id: fracId });
      updateItems(newItems, { path: [...cursor.path, { id: fracId, field: 'den' }], offset: 0 });
    } else if (cmd === 'Backspace') {
      if (cursor.offset > 0) {
        const newItems = cloneDeep(items);
        const arr = getTargetArray(newItems, cursor.path);
        const leftItem = arr[cursor.offset - 1];
        if (leftItem.type === 'char') {
          arr.splice(cursor.offset - 1, 1);
          updateItems(newItems, { ...cursor, offset: cursor.offset - 1 });
        } else if (leftItem.type === 'sup') {
          setCursor({ path: [...cursor.path, { id: leftItem.id, field: 'exp' }], offset: leftItem.exp.length });
        } else if (leftItem.type === 'frac') {
          setCursor({ path: [...cursor.path, { id: leftItem.id, field: 'den' }], offset: leftItem.den.length });
        } else if (leftItem.type === 'sqrt' || leftItem.type === 'func') {
          setCursor({ path: [...cursor.path, { id: leftItem.id, field: 'arg' }], offset: leftItem.arg.length });
        }
      } else if (cursor.path.length > 0) {
        const newPath = cursor.path.slice(0, -1);
        const last = cursor.path[cursor.path.length - 1];
        const newItems = cloneDeep(items);
        const parentArr = getTargetArray(newItems, newPath);
        const nodeIndex = parentArr.findIndex(i => i.id === last.id);
        const node = parentArr[nodeIndex] as any;
        if (last.field === 'exp') {
          parentArr.splice(nodeIndex, 1, ...node.exp);
          updateItems(newItems, { path: newPath, offset: nodeIndex });
        } else if (last.field === 'arg') {
          parentArr.splice(nodeIndex, 1, ...node.arg);
          updateItems(newItems, { path: newPath, offset: nodeIndex });
        } else if (last.field === 'den' || last.field === 'num') {
          parentArr.splice(nodeIndex, 1, ...node.num, ...node.den);
          updateItems(newItems, { path: newPath, offset: last.field === 'den' ? nodeIndex + node.num.length : nodeIndex });
        }
      }
    } else {
      const newItems = cloneDeep(items);
      const arr = getTargetArray(newItems, cursor.path);
      const newNodes = cmd.split('').map(c => ({ type: 'char' as const, char: c, id: uid() }));
      arr.splice(cursor.offset, 0, ...newNodes);
      updateItems(newItems, { ...cursor, offset: cursor.offset + newNodes.length });
    }
  };


  const isCursorHere = (path: CursorState['path'], offset: number) => {
    if (!focused) return false;
    if (cursor.path.length !== path.length) return false;
    for (let i = 0; i < cursor.path.length; i++) {
      if (cursor.path[i].id !== path[i].id || cursor.path[i].field !== path[i].field) return false;
    }
    return cursor.offset === offset;
  };

  const cursorEl = <mo className="math-cursor" key="cursor">|</mo>;

  const renderItems = (nodeItems: EditorItem[], currentPath: CursorState['path']): ReactNode[] => {
    const nodes: ReactNode[] = [];
    if (isCursorHere(currentPath, 0)) nodes.push(cursorEl);

    for (let i = 0; i < nodeItems.length; i++) {
      const item = nodeItems[i];
      if (item.type === 'char') {
        const isNum = /[0-9.]/.test(item.char);
        if (isNum) nodes.push(<mn key={item.id}>{item.char}</mn>);
        else if (['+', '-', '*', '=', '<', '>', '(', ')', ','].includes(item.char)) nodes.push(<mo key={item.id}>{item.char}</mo>);
        else nodes.push(<mi key={item.id}>{item.char}</mi>);
      } else if (item.type === 'frac') {
        nodes.push(
          <mfrac key={item.id}>
            <mrow>{renderItems(item.num, [...currentPath, { id: item.id, field: 'num' }])}</mrow>
            <mrow>{renderItems(item.den, [...currentPath, { id: item.id, field: 'den' }])}</mrow>
          </mfrac>
        );
      } else if (item.type === 'sup') {
        const prev = nodes.pop();
        let baseNodes = [];
        if (prev === cursorEl) {
          const realPrev = nodes.pop();
          baseNodes = realPrev ? [realPrev, cursorEl] : [cursorEl];
        } else if (prev) {
          baseNodes = [prev];
        } else {
          baseNodes = [<mo key={`empty-base-${item.id}`}>&nbsp;</mo>];
        }
        nodes.push(
          <msup key={item.id}>
            <mrow>{baseNodes}</mrow>
            <mrow>{renderItems(item.exp, [...currentPath, { id: item.id, field: 'exp' }])}</mrow>
          </msup>
        );
      } else if (item.type === 'sqrt') {
        nodes.push(<msqrt key={item.id}><mrow className="sqrt-radicand">{renderItems(item.arg, [...currentPath, { id: item.id, field: 'arg' }])}</mrow></msqrt>);
      } else if (item.type === 'func') {
        nodes.push(
          <React.Fragment key={item.id}>
            <mi>{item.name}</mi><mo>(</mo>
            <mrow>{renderItems(item.arg, [...currentPath, { id: item.id, field: 'arg' }])}</mrow>
            <mo className="math-placeholder">)</mo>
          </React.Fragment>
        );
      }
      if (isCursorHere(currentPath, i + 1)) nodes.push(cursorEl);
    }
    if (nodes.length === 0 || (nodes.length === 1 && nodes[0] === cursorEl)) {
      nodes.push(<mo key={`empty-${currentPath.length}`} className="math-empty">&#8203;</mo>); // zero width space to maintain layout height
    }
    return nodes;
  };

  const CALC_LAYOUT = [
    [{ label: 'z', cmd: 'z' }, { label: 'x', cmd: 'x' }, { label: 'y', cmd: 'y' }, { label: 'e', cmd: 'e' }, { label: 'π', cmd: 'π' }, { label: 'i', cmd: 'i' }],
    [{ label: '7', cmd: '7' }, { label: '8', cmd: '8' }, { label: '9', cmd: '9' }, { label: '(', cmd: '(' }, { label: ')', cmd: ')' }, { label: '⌫', cmd: 'Backspace' }],
    [{ label: '4', cmd: '4' }, { label: '5', cmd: '5' }, { label: '6', cmd: '6' }, { label: '·', cmd: '*' }, { label: '÷', cmd: '/' }, { label: '/', cmd: 'frac' }],
    [{ label: '1', cmd: '1' }, { label: '2', cmd: '2' }, { label: '3', cmd: '3' }, { label: '+', cmd: '+' }, { label: '−', cmd: '-' }, { label: '^', cmd: '^' }],
    [{ label: '0', cmd: '0' }, { label: '.', cmd: '.' }, { label: '=', cmd: '=' }],
  ];

  const FUNC_LAYOUT = [
    [{ label: 'sin', cmd: 'sin' }, { label: 'cos', cmd: 'cos' }, { label: 'tan', cmd: 'tan' }, { label: 'ln', cmd: 'ln' }, { label: 'log', cmd: 'log' }],
    [{ label: 'sinh', cmd: 'sinh' }, { label: 'cosh', cmd: 'cosh' }, { label: 'tanh', cmd: 'tanh' }, { label: 'exp', cmd: 'exp' }, { label: '√', cmd: 'sqrt' }],
  ];

  const layoutToUse = keyboardTab === 'calculator' ? CALC_LAYOUT : FUNC_LAYOUT;

  return (
    <div className="math-editor-container">
      <div 
        id="function-input"
        ref={containerRef}
        className={`math-editor ${focused ? 'focused' : ''}`}
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        onClick={() => { if (!focused) containerRef.current?.focus(); }}
        aria-label="Mathematical expression editor"
      >
        <math display="inline">
          <mrow>{renderItems(items, [])}</mrow>
        </math>
      </div>
      <button 
        className="math-keyboard-toggle"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setShowKeyboard(!showKeyboard)}
      >
        ⌨ {showKeyboard ? 'Hide Math Keyboard' : 'Math Keyboard'}
      </button>
      {showKeyboard && (
        <div className="math-keyboard">
          <div className="math-keyboard-tabs">
            <button 
              className={`math-keyboard-tab ${keyboardTab === 'calculator' ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setKeyboardTab('calculator')}
            >
              Calculator
            </button>
            <button 
              className={`math-keyboard-tab ${keyboardTab === 'functions' ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setKeyboardTab('functions')}
            >
              Functions
            </button>
          </div>
          {layoutToUse.map((row, rIdx) => (
            <div key={rIdx} className="math-keyboard-row">
              {row.map(btn => (
                <button
                  key={btn.label}
                  className="math-keyboard-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => executeCommand(btn.cmd)}
                  title={btn.cmd === 'frac' ? 'Fraction' : btn.label}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
