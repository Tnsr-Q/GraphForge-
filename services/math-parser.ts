
import { create, all, Parser } from 'mathjs';
import { G3DFunction } from '../types';

const math = create(all, {});

export const createConfiguredMathParser = (functions: { [key: string]: G3DFunction }): Parser => {
    const parser = math.parser();
    parser.evaluate('STR(x) = format(x, {notation: "fixed", precision: 2})');
    const aliases: { [key: string]: string } = { 'SIN': 'sin', 'COS': 'cos', 'TAN': 'tan', 'ASIN': 'asin', 'ACOS': 'acos', 'ATAN': 'atan', 'ATAN2': 'atan2', 'ATN2': 'atan2', 'SQRT': 'sqrt', 'LOG': 'log', 'EXP': 'exp', 'POW': 'pow', 'ABS': 'abs', 'PI': 'pi' };
    for (const alias in aliases) { try { parser.evaluate(`${alias} = ${aliases[alias]}`); } catch (e) { console.warn(`Could not create alias for ${alias}:`, e); } }
    const remainingFunctions = { ...functions }; let changedInLastPass = true; const maxPasses = Object.keys(functions).length + 1; let passes = 0;
    while (Object.keys(remainingFunctions).length > 0 && changedInLastPass && passes < maxPasses) {
        changedInLastPass = false; passes++;
        for (const name in remainingFunctions) {
            const fn = remainingFunctions[name]; const signature = `${name}${fn.params.length > 0 ? `(${fn.params.join(',')})` : ''}`;
            try { parser.evaluate(`${signature} = ${fn.body}`); delete remainingFunctions[name]; changedInLastPass = true; } catch (e) { /* Ignore, will retry */ }
        }
    }
    if (Object.keys(remainingFunctions).length > 0) { console.warn('Could not define the following functions:', Object.keys(remainingFunctions)); }
    return parser;
};
