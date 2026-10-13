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
    let deviceId = null;
    let quantidadeFichas = 0;

    // ==========================================
    // 1. CHECAGEM PIX (MERCADO PAGO)
    // ==========================================
    if (gateway === 'pix') {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${transacaoId}`, {
        headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` }
      });
      const mpData = await mpRes.json();
      
      if (mpData.status === 'approved') {
        pago = true;
        // Puxa o ID do celular e a quantidade escondidos no metadata que configuramos antes
        deviceId = mpData.metadata?.device_id;
        quantidadeFichas = parseInt(mpData.metadata?.quantidade_fichas) || 0;
      }
    }

    // ==========================================
    // 2. CHECAGEM CRIPTO (NOWPAYMENTS)
    // ==========================================
    else if (gateway === 'crypto') {
      const npRes = await fetch(`https://api.nowpayments.io/v1/invoice/${transacaoId}`, {
        headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY }
      });
      const npData = await npRes.json();
      
      if (npData.payment_status === 'paid' || npData.payment_status === 'finished' || npData.payment_status === 'confirmed') {
        pago = true;
        // NOTA: Para Cripto e Stripe funcionarem como o PIX, você precisará garantir que os scripts 
        // de 'gerar-crypto' e 'gerar-stripe' também salvem o deviceId no metadata/order_description.
        deviceId = npData.order_description; // Exemplo de onde a NowPayments guarda dados extras
        quantidadeFichas = parseInt(npData.price_amount) || 0; // Ajuste conforme sua lógica
      }
    }

    // ==========================================
    // 3. CHECAGEM CARTÃO (STRIPE)
    // ==========================================
    else if (gateway === 'stripe') {
      const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${transacaoId}`, {
        headers: { 'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      });
      const stripeData = await stripeRes.json();
      
      if (stripeData.payment_status === 'paid' || stripeData.status === 'complete') {
        pago = true;
        deviceId = stripeData.metadata?.device_id;
        quantidadeFichas = parseInt(stripeData.metadata?.quantidade_fichas) || 0;
      }
    }

    // ==========================================
    // 4. INJEÇÃO SEGURA NO FIREBASE (BLINDAGEM)
    // ==========================================
    if (pago && deviceId && quantidadeFichas > 0) {
      const firebaseUrl = 'https://super-slot-89c3e-default-rtdb.firebaseio.com';
      
      // A. Checa se essa transação já foi processada antes (Impede a multiplicação de fichas)
      const checkRes = await fetch(`${firebaseUrl}/transacoes_processadas/${transacaoId}.json`);
      const isProcessed = await checkRes.json();

      if (!isProcessed) {
        // B. Se é nova, busca o saldo atual desse jogador
        const saldoRes = await fetch(`${firebaseUrl}/aparelhos_registrados/${deviceId}/saldo.json`);
        let saldoAtual = await saldoRes.json();
        if (saldoAtual === null) saldoAtual = 0; // Se der erro, assume 0

        // C. Soma as fichas novas de forma matemática no servidor
        const novoSaldo = parseInt(saldoAtual) + quantidadeFichas;

        // D. Salva o saldo novo no banco de dados do jogador
        await fetch(`${firebaseUrl}/aparelhos_registrados/${deviceId}/saldo.json`, {
          method: 'PUT',
          body: JSON.stringify(novoSaldo),
          headers: { 'Content-Type': 'application/json' }
        });

        // E. Carimba a transação como processada para NUNCA mais somar ela de novo
        await fetch(`${firebaseUrl}/transacoes_processadas/${transacaoId}.json`, {
          method: 'PUT',
          body: JSON.stringify(true),
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return res.status(200).json({ sucesso: true, pago: pago });

  } catch (error) {
    console.error("Erro na verificação:", error);
    return res.status(500).json({ sucesso: false, error: error.message });
  }
}
