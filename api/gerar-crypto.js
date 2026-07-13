export default async function handler(req, res) {
  // Configuração de CORS para aceitar a conexão do Unity
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Libera a requisição de pré-checagem (Preflight) do navegador/Unity
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Bloqueia qualquer coisa que não seja POST
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, error: 'Método não permitido' });
  }

  try {
    // Tratamento para ler o corpo da requisição enviada pelo Unity como texto simples
    let corpo = req.body;
    if (typeof corpo === 'string') {
      try { corpo = JSON.parse(corpo); } catch(e) {}
    }

    const quantidadeFichas = corpo?.quantidadeFichas;

    // Trava de segurança: se o Unity não enviou a quantidade, aborta
    if (quantidadeFichas === undefined || quantidadeFichas === null) {
      return res.status(400).json({ 
        sucesso: false, 
        error: "O servidor não conseguiu ler a quantidade de fichas."
      });
    }

    // Tabela de preços (em Dólares)
    let precoDolar = 1.99;
    let nomePacote = `${quantidadeFichas} Tokens`;
    
    if (quantidadeFichas === 5) precoDolar = 1.99;
    else if (quantidadeFichas === 10) precoDolar = 2.99;
    else if (quantidadeFichas === 50) precoDolar = 9.99;
    else precoDolar = 1.99; // Preço de segurança

    // Comunicação com o NowPayments
    const respostaNowPayments = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: precoDolar,
        price_currency: 'usd',
        order_id: 'HologramCoin_' + Date.now(),
        order_description: nomePacote,
        success_url: 'https://www.hologram-coin.com',
        cancel_url: 'https://www.hologram-coin.com'
      })
    });

    const dadosFatura = await respostaNowPayments.json();

    // Se a API do NowPayments recusou a criação (ex: chave errada), devolve o erro
    if (!respostaNowPayments.ok) {
      throw new Error(dadosFatura.message || "Erro ao gerar fatura cripto no NowPayments");
    }

    // Sucesso! Devolve o link da tela de pagamento para o Unity abrir
    return res.status(200).json({
      sucesso: true,
      urlCheckout: dadosFatura.invoice_url 
    });

  } catch (error) {
    console.error("Erro interno Cripto:", error);
    return res.status(500).json({ sucesso: false, error: error.message });
  }
}