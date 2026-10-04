/**
 * Erros de aplicação "esperados" (regra de negócio, validação, conflito).
 * Tudo que NÃO for AppError é tratado como falha inesperada pelo error handler
 * global e vira 500 genérico, sem vazar detalhes internos para o cliente.
 */
export class AppError extends Error {
  /**
   * @param {number} status   código HTTP
   * @param {string} codigo   identificador estável, legível por máquina (o front usa para i18n)
   * @param {string} mensagem texto seguro para exibir ao usuário
   * @param {object} [detalhes] dados extras seguros (nunca dados pessoais de terceiros)
   */
  constructor(status, codigo, mensagem, detalhes) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

export const requisicaoInvalida = (codigo, mensagem, detalhes) => new AppError(400, codigo, mensagem, detalhes);
export const conflito = (codigo, mensagem, detalhes) => new AppError(409, codigo, mensagem, detalhes);
export const naoEncontrado = (mensagem = 'Recurso não encontrado') => new AppError(404, 'NAO_ENCONTRADO', mensagem);
