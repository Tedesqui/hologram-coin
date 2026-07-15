const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Libera a conexão do Unity
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, error: 'Método não permitido' });
  }

  try {
    let corpo = req.body;
    if (typeof corpo === 'string') {
      try { corpo = JSON.parse(corpo); } catch(e) {}
    }

    const quantidadeFichas = corpo?.quantidadeFichas;

    if (quantidadeFichas === undefined || quantidadeFichas === null) {
      return res.status(400).json({ 
        sucesso: false, 
        error: "O servidor não conseguiu ler a quantidade de fichas."
      });
    }

    let precoCentavos = 199;
    let nomePacote = `${quantidadeFichas} Tokens`;
    
    if (quantidadeFichas === 5) precoCentavos = 199;
    else if (quantidadeFichas === 10) precoCentavos = 299;
    else if (quantidadeFichas === 50) precoCentavos = 999;
    else precoCentavos = 199;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: nomePacote,
              description: 'Tokens for Hologram SUPER SLOT',
            },
            unit_amount: precoCentavos,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // O STRIPE EXIGE O HTTPS:// AQUI PARA NÃO DAR ERRO 400
      success_url: 'https://www.hologram-coin.com/',
      cancel_url: 'https://www.hologram-coin.com/',
    });

    return res.status(200).json({
      sucesso: true,
      urlCheckout: session.url,
      pagamentoId: session.id // <--- ESTA É A LINHA QUE FAZ O SISTEMA DE VERIFICAÇÃO FUNCIONAR
    });

  } catch (error) {
    console.error("Erro interno do Stripe:", error);
    return res.status(500).json({ sucesso: false, error: error.message });
  }
}
