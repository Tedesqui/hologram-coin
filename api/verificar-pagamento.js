export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ sucesso: false, error: 'Método não permitido' });

  try {
    let corpo = req.body;
    if (typeof corpo === 'string') {
      try { corpo = JSON.parse(corpo); } catch(e) {}
    }

    const { gateway, transacaoId } = corpo;

    if (!gateway || !transacaoId) {
      return res.status(400).json({ sucesso: false, error: 'Faltam dados da transação' });
    }

    let pago = false;

    // 1. CHECAGEM PIX (MERCADO PAGO)
    if (gateway === 'pix') {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${transacaoId}`, {
        headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }
      });
      const mpData = await mpRes.json();
      if (mpData.status === 'approved') pago = true;
    }

    // 2. CHECAGEM CRIPTO (NOWPAYMENTS)
    else if (gateway === 'crypto') {
      const npRes = await fetch(`https://api.nowpayments.io/v1/invoice/${transacaoId}`, {
        headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY }
      });
      const npData = await npRes.json();
      // O NowPayments tem 3 status que significam que o dinheiro entrou
      if (npData.payment_status === 'paid' || npData.payment_status === 'finished' || npData.payment_status === 'confirmed') {
        pago = true;
      }
    }

    // 3. CHECAGEM CARTÃO (STRIPE)
    else if (gateway === 'stripe') {
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${transacaoId}`, {
        headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      });
      const stripeData = await stripeRes.json();
      if (stripeData.payment_status === 'paid' || stripeData.status === 'complete') pago = true;
    }

    return res.status(200).json({ sucesso: true, pago: pago });

  } catch (error) {
    console.error("Erro na verificação:", error);
    return res.status(500).json({ sucesso: false, error: error.message });
  }
}