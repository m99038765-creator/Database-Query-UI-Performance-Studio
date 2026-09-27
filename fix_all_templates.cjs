const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace any template literal `...${expr}...` with string concatenation.
// A robust function to parse and convert template literals:
function convertTemplateLiterals(str) {
  // We can find template literals. Since template literals can span lines, let's use a regex or tokenizing approach.
  // Actually, let's find all backtick strings.
  let result = '';
  let i = 0;
  while (i < str.length) {
    if (str[i] === '`') {
      // Find closing backtick (ignoring escaped backticks)
      let j = i + 1;
      let insideExpr = false;
      let exprDepth = 0;
      let templateContent = '';
      while (j < str.length) {
        if (str[j] === '\\') {
          templateContent += str[j] + str[j+1];
          j += 2;
          continue;
        }
        if (str[j] === '`' && !insideExpr && exprDepth === 0) {
          break;
        }
        if (str[j] === '$' && str[j+1] === '{') {
          insideExpr = true;
          exprDepth++;
          templateContent += '${';
          j += 2;
          continue;
        }
        if (insideExpr && str[j] === '}') {
          exprDepth--;
          if (exprDepth === 0) {
            insideExpr = false;
          }
          templateContent += '}';
          j++;
          continue;
        }
        templateContent += str[j];
        j++;
      }
      if (j < str.length && str[j] === '`') {
        // We found a complete template literal `templateContent`
        // Now convert templateContent to string concatenation
        let converted = parseTemplateContent(templateContent);
        result += converted;
        i = j + 1;
        continue;
      }
    }
    result += str[i];
    i++;
  }
  return result;
}

function parseTemplateContent(content) {
  // templateContent has literal parts and ${...} parts
  let parts = [];
  let currentLiteral = '';
  let i = 0;
  let insideExpr = false;
  let exprDepth = 0;
  let currentExpr = '';

  while (i < content.length) {
    if (!insideExpr && content[i] === '$' && content[i+1] === '{') {
      if (currentLiteral !== '') {
        parts.push({ type: 'literal', value: currentLiteral });
        currentLiteral = '';
      }
      insideExpr = true;
      exprDepth = 1;
      i += 2;
      currentExpr = '';
      continue;
    }
    if (insideExpr) {
      if (content[i] === '{') {
        exprDepth++;
      } else if (content[i] === '}') {
        exprDepth--;
        if (exprDepth === 0) {
          insideExpr = false;
          parts.push({ type: 'expr', value: currentExpr });
          i++;
          continue;
        }
      }
      currentExpr += content[i];
      i++;
      continue;
    }
    currentLiteral += content[i];
    i++;
  }
  if (currentLiteral !== '') {
    parts.push({ type: 'literal', value: currentLiteral });
  }

  if (parts.length === 0) return "''";
  if (parts.length === 1) {
    if (parts[0].type === 'literal') {
      return JSON.stringify(parts[0].value);
    } else {
      return `(${parts[0].value})`;
    }
  }

  let exprs = parts.map(p => {
    if (p.type === 'literal') {
      return JSON.stringify(p.value);
    } else {
      return `(${p.value})`;
    }
  });

  return exprs.join(' + ');
}

let newContent = convertTemplateLiterals(content);
fs.writeFileSync('src/App.tsx', newContent, 'utf8');
console.log('Successfully converted all template literals to string concatenations!');
