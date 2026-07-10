const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Configuração de CORS para permitir que o aplicativo Unity se comunique sem bloqueios
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responde rapidamente ao "Preflight" do navegador/Unity
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Bloqueia qualquer tentativa que não seja um envio de dados (POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, error: 'Método não permitido. Use POST.' });
  }

  try {
    const { quantidadeFichas, emailJogador } = req.body;

    // Converte a quantidade de fichas nos preços exatos em dólares americanos (centavos)
    let unit_amount = 0;
    if (quantidadeFichas === 5) unit_amount = 199;       // $1.99
    else if (quantidadeFichas === 10) unit_amount = 299; // $2.99
    else if (quantidadeFichas === 50) unit_amount = 999; // $9.99
    else {
        return res.status(400).json({ sucesso: false, error: 'Quantidade de pacotes inválida.' });
    }

    // Cria a sessão de pagamento segura hospedada pelo próprio Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: emailJogador, // Opcional: preenche o email do cliente automaticamente se você tiver
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${quantidadeFichas} AR Tokens`,
              description: `Virtual currency for Augmented Reality game.`,
            },
            unit_amount: unit_amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // URLs para onde o Stripe manda o usuário após ele pagar ou cancelar
      // Como o usuário está no celular, essas páginas abrirão no navegador.
      success_url: 'https://hologram-coin.com/sucesso.html', 
      cancel_url: 'https://hologram-coin.com/cancelado.html',
    });

    // Devolve a URL do Checkout para o Unity abrir a tela no celular
    return res.status(200).json({
      sucesso: true,
      urlCheckout: session.url
    });

  } catch (error) {
    console.error('Erro crítico no Stripe:', error);
    return res.status(500).json({ sucesso: false, error: 'Erro interno ao processar o pagamento.' });
  }
}