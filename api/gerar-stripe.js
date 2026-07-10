const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // 1. Libera o acesso para o Unity conseguir se comunicar sem bloqueio (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responde rapidamente a checagens de segurança do navegador/celular
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Proteção: Só aceita métodos POST (que é o que o Unity usa para enviar dados)
  if (req.method !== 'POST') {
    return res.status(405).json({ sucesso: false, error: 'Método não permitido' });
  }

  try {
    // 3. Lê o pacote exato que o Unity mandou
    const { quantidadeFichas } = req.body;

    // Se o Unity não mandou a quantidade, retorna o famoso erro 400
    if (!quantidadeFichas) {
      return res.status(400).json({ sucesso: false, error: "Faltou enviar a quantidade de fichas" });
    }

    // 4. Define o preço em centavos baseado no clique do jogador ($1.99 = 199 centavos)
    let precoCentavos = 0;
    if (quantidadeFichas === 5) precoCentavos = 199;
    else if (quantidadeFichas === 10) precoCentavos = 299;
    else if (quantidadeFichas === 50) precoCentavos = 999;
    else precoCentavos = 199; // Segurança caso venha um valor estranho

    // 5. Cria a tela de pagamento oficial no Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${quantidadeFichas} Tokens`,
              description: 'Premium Tokens',
            },
            unit_amount: precoCentavos,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Para onde o jogador vai depois que pagar ou cancelar (pode ser seu Instagram ou site)
      success_url: 'https://google.com',
      cancel_url: 'https://google.com',
    });

    // 6. Devolve a URL do Checkout de volta para o Unity abrir o navegador!
    return res.status(200).json({
      sucesso: true,
      urlCheckout: session.url
    });

  } catch (error) {
    console.error("Erro interno:", error);
    return res.status(500).json({ sucesso: false, error: error.message });
  }
}
