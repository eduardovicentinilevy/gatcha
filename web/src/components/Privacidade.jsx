import { CONFIG } from '../config.js';

/**
 * Aviso de privacidade (LGPD, Lei 13.709/2018). Os dados variáveis (controlador,
 * contato, prazos) vêm de CONFIG.lgpd; os prazos precisam bater com os da API.
 */
export default function Privacidade({ className = '' }) {
  const { controlador, contatoTitular, retencaoInteressesDias, atualizadoEm } = CONFIG.lgpd;
  const contato = contatoTitular ? <a href={`mailto:${contatoTitular}`}>{contatoTitular}</a> : 'a equipe do Gatchá, no balcão do café';
  const data = new Date(`${atualizadoEm}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <main id="conteudo" className={`container texto cartao ${className}`}>
      <p className="sobretitulo">LGPD</p>
      <h1>Aviso de privacidade</h1>
      <p>
        Este aviso explica, em linguagem simples, quais dados pessoais o site do Gatchá coleta, para quê, com quem compartilha, por quanto
        tempo guarda e como você exerce seus direitos, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Atualizado em {data}.
      </p>

      <h2>Quem é o responsável pelos seus dados</h2>
      <p>
        {controlador.razaoSocial ? <strong>{controlador.razaoSocial}</strong> : <strong>Gatchá Cat Café</strong>}
        {controlador.cnpj ? `, CNPJ ${controlador.cnpj}` : ''}, {CONFIG.endereco.linha1}, {CONFIG.endereco.linha2}.
        Para qualquer assunto sobre privacidade, fale com {contato}.
      </p>

      <h2>Quais dados coletamos e por quê</h2>
      <ul>
        <li><strong>Interesse em adoção:</strong> nome, um contato (e-mail ou celular) e a mensagem que você escrever. Usamos para repassar seu interesse à ONG Abrigo São Gabriel (base legal: o seu consentimento, dado ao marcar a caixa do formulário).</li>
      </ul>
      <p>
        O site não faz reservas (elas são feitas no balcão) e não pedimos CPF, endereço, dados de pagamento nem dados sensíveis. O site não usa cookies de
        rastreamento nem de publicidade; só guarda, no seu próprio navegador, a sua escolha de tema claro ou escuro.
      </p>

      <h2>Com quem compartilhamos</h2>
      <ul>
        <li><strong>ONG Abrigo São Gabriel:</strong> recebe apenas os pedidos de interesse em adoção.</li>
        <li><strong>Prestadores de tecnologia</strong> (hospedagem do site e da API e banco de dados), que tratam os dados só em nosso nome e para este fim.</li>
        <li><strong>Google:</strong> o mapa da página “Visite” só carrega quando você clica em “Mostrar mapa”; nesse momento o Google recebe os dados técnicos da sua visita (como o IP).</li>
      </ul>
      <p>Não vendemos seus dados nem os usamos para marketing.</p>

      <h2>Por quanto tempo guardamos</h2>
      <ul>
        <li><strong>Interesses de adoção:</strong> apagados automaticamente {retencaoInteressesDias} dias após o envio.</li>
      </ul>

      <h2>Seus direitos</h2>
      <p>
        Você pode, a qualquer momento e gratuitamente, pedir: confirmação de que tratamos seus dados; acesso a eles; correção; eliminação;
        informações sobre com quem compartilhamos; e a retirada do consentimento. Basta escrever para {contato} pelo mesmo e-mail ou
        celular que você informou, para confirmarmos que o pedido é seu. Respondemos em até 15 dias. Se achar que algo não foi
        resolvido, você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>Como protegemos seus dados</h2>
      <p>
        A conexão com o site é criptografada (HTTPS). Os dados ficam num banco protegido por senha e acessado só pela nossa API. O painel
        da equipe exige login com senha protegida por criptografia, e cada acesso fica registrado para auditoria. Coletamos o mínimo
        necessário e apagamos quando a finalidade acaba.
      </p>

      <p><a href="/">← Voltar ao site</a></p>
    </main>
  );
}
