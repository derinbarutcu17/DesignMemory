import ts from 'typescript';

export type ClassTokenUsage = {
  value: string;
  line: number;
  column: number;
};

export type StylePropUsage = {
  key: string;
  value: string;
  line: number;
  column: number;
};

export type StyleUsages = {
  classTokens: ClassTokenUsage[];
  styleProps: StylePropUsage[];
  inlineStyleCount: number;
};

function positionOf(sourceFile: ts.SourceFile, node: ts.Node) {
  const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: pos.line + 1, column: pos.character + 1 };
}

const CLASS_HELPERS = new Set(['cn', 'clsx', 'classnames', 'classNames', 'twMerge', 'cx']);

function extractStaticText(
  initializer: ts.Expression | undefined,
  sourceFile: ts.SourceFile,
): { text: string; line: number; column: number } | null {
  if (!initializer) {
    return null;
  }

  const resolve = (expr: ts.Expression): { text: string; line: number; column: number } | null => {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
      return { text: expr.text, ...positionOf(sourceFile, expr) };
    }
    if (ts.isTemplateExpression(expr)) {
      const parts = [expr.head.text, ...expr.templateSpans.map((span) => span.literal.text)];
      return { text: parts.join(' '), ...positionOf(sourceFile, expr) };
    }
    if (ts.isParenthesizedExpression(expr)) {
      return resolve(expr.expression);
    }
    if (ts.isConditionalExpression(expr)) {
      const whenTrue = resolve(expr.whenTrue);
      const whenFalse = resolve(expr.whenFalse);
      const text = [whenTrue?.text, whenFalse?.text].filter(Boolean).join(' ');
      return text ? { text, ...positionOf(sourceFile, expr) } : null;
    }
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return resolve(expr.right);
    }
    if (ts.isCallExpression(expr)) {
      const callee = expr.expression.getText(sourceFile).split('.').pop() ?? '';
      if (!CLASS_HELPERS.has(callee)) {
        return null;
      }
      const parts = expr.arguments.map((argument) => resolve(argument)?.text ?? '').filter(Boolean);
      return parts.length > 0 ? { text: parts.join(' '), ...positionOf(sourceFile, expr) } : null;
    }
    return null;
  };

  if (ts.isJsxExpression(initializer)) {
    return initializer.expression ? resolve(initializer.expression) : null;
  }
  return resolve(initializer);
}

/**
 * Extract deterministic style usages from TSX source: className/class attribute
 * tokens and inline style object properties. Only static values are inspected;
 * dynamic expressions are ignored because they cannot be checked deterministically.
 */
export function extractStyleUsages(
  content: string,
  scriptKind: ts.ScriptKind = ts.ScriptKind.TSX,
): StyleUsages {
  const usages: StyleUsages = { classTokens: [], styleProps: [], inlineStyleCount: 0 };
  const sourceFile = ts.createSourceFile('component.tsx', content, ts.ScriptTarget.Latest, true, scriptKind);

  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile);
      if (name === 'className' || name === 'class') {
        const staticText = extractStaticText(node.initializer, sourceFile);
        if (staticText) {
          for (const token of staticText.text.split(/\s+/).filter(Boolean)) {
            usages.classTokens.push({ value: token, line: staticText.line, column: staticText.column });
          }
        }
      } else if (name === 'style') {
        const initializer = node.initializer;
        if (initializer && ts.isJsxExpression(initializer) && initializer.expression && ts.isObjectLiteralExpression(initializer.expression)) {
          usages.inlineStyleCount += 1;
          for (const prop of initializer.expression.properties) {
            if (!ts.isPropertyAssignment(prop)) {
              continue;
            }
            const key = prop.name.getText(sourceFile);
            const value =
              ts.isStringLiteral(prop.initializer) || ts.isNumericLiteral(prop.initializer)
                ? prop.initializer.text
                : prop.initializer.getText(sourceFile);
            usages.styleProps.push({ key, value, ...positionOf(sourceFile, prop) });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usages;
}

export function scriptKindForFile(filePath: string): ts.ScriptKind {
  return filePath.toLowerCase().endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.TSX;
}
