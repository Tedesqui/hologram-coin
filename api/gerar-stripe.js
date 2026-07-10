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
    // Tenta ler o corpo independente do formato que o Unity enviou
    let corpo = req.body;
    if (typeof corpo === 'string') {
      try { corpo = JSON.parse(corpo); } catch(e) {}
    }

    const quantidadeFichas = corpo?.quantidadeFichas;

    // Agora só bloqueia se realmente estiver ausente (aceita se o Unity mandar o número 0 por engano)
    if (quantidadeFichas === undefined || quantidadeFichas === null) {
      return res.status(400).json({ 
        sucesso: false, 
        error: "O servidor não conseguiu ler o número enviado. O Unity mandou: " + JSON.stringify(req.body)
      });
    }

    // Calcula o preço: se o Unity mandar 0 por engano, cobra o valor mínimo para não travar
    let precoCentavos = 199;
    let nomePacote = `${quantidadeFichas} Tokens`;
    
    if (quantidadeFichas === 5) precoCentavos = 199;
    else if (quantidadeFichas === 10) precoCentavos = 299;
    else if (quantidadeFichas === 50) precoCentavos = 999;
    else {
        // Se cair aqui, é porque a caixinha no Unity ficou vazia e enviou "0"
        precoCentavos = 199;
        nomePacote = "Tokens (Erro: Unity enviou Zero)";
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: nomePacote,
              description: 'Premium Tokens',
            },
            unit_amount: precoCentavos,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://google.com',
      cancel_url: 'https://google.com',
    });

    return res.status(200).json({
      sucesso: true,
      urlCheckout: session.url
    });

  } catch (error) {
    console.error("Erro interno:", error);
    return res.status(500).json({ sucesso: false, error: error.message });
  }
}
