import { AppError, requisicaoInvalida } from '../lib/erros.js';

const PARTES = ['params', 'query', 'body'];

/**
 * Valida e SANITIZA params/query/body com schemas Zod.
 * O resultado normalizado fica em `req.validado` — o controller nunca lê
 * req.body/req.query crus. Todos os problemas são devolvidos de uma vez (400).
 *
 * @param {{ params?: import('zod').ZodType, query?: import('zod').ZodType, body?: import('zod').ZodType }} schemas
 */
export function validar(schemas) {
  return (req, _res, next) => {
    if (schemas.body && !req.is('application/json')) {
      return next(new AppError(415, 'TIPO_DE_CONTEUDO_NAO_SUPORTADO', 'Envie o corpo como application/json.'));
    }

    const validado = {};
    const campos = [];
    for (const parte of PARTES) {
      const schema = schemas[parte];
      if (!schema) continue;
      const resultado = schema.safeParse(req[parte] ?? {});
      if (resultado.success) {
        validado[parte] = resultado.data;
      } else {
        for (const issue of resultado.error.issues) {
          campos.push({ campo: [parte, ...issue.path].join('.'), mensagem: issue.message });
        }
      }
    }

    if (campos.length > 0) return next(requisicaoInvalida('DADOS_INVALIDOS', 'Verifique os dados enviados.', { campos }));
    req.validado = validado;
    next();
  };
}
