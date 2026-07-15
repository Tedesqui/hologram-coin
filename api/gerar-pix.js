const { MercadoPagoConfig, Payment } = require('mercadopago');

// Inicializa o SDK do Mercado Pago com o seu Access Token de Produção
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-3764782098986115-120119-abf8f02a754b2fefb3757ef148fd4731-2610700247' 
});

const payment = new Payment(client);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    try {
        // Agora recebemos a quantidade de fichas que o jogador escolheu no Unity
        const { quantidadeFichas, emailJogador } = req.body;

        // Tabela de preços fixa e segura no servidor (protegida contra hackers)
        let valorCalculado = 0;

        switch (parseInt(quantidadeFichas)) {
            case 5:
                valorCalculado = 4.90;
                break;
            case 10:
                valorCalculado = 6.90;
                break;
            case 50:
                valorCalculado = 19.90;
                break;
            default:
                // Se enviarem qualquer quantidade que não esteja na promoção, o servidor rejeita
                return res.status(400).json({ 
                    sucesso: false, 
                    error: 'Pacote de fichas inválido ou não reconhecido.' 
                });
        }

        const body = {
            transaction_amount: valorCalculado, // O valor é definido aqui de forma segura
            description: `Compra de ${quantidadeFichas} Fichas - Jogo AR`,
            payment_method_id: 'pix',
            payer: {
                email: emailJogador || 'jogador_anonimo@email.com'
            },
            notification_url: 'https://direitaia.vercel.app/api/webhook' 
        };

        const resultado = await payment.create({ body });

        const pixCopiaECola = resultado.point_of_interaction.transaction_data.qr_code;
        const qrCodeBase64 = resultado.point_of_interaction.transaction_data.qr_code_base64;
        const pagamentoId = resultado.id;

        return res.status(200).json({
            sucesso: true,
            pagamentoId: pagamentoId,
            quantidadeFichas: quantidadeFichas,
            valorCobrado: valorCalculado,
            pixCopiaCola: pixCopiaECola,
            qrCodeBase64: qrCodeBase64
        });

    } catch (error) {
        console.error('Erro ao gerar PIX:', error);
        return res.status(500).json({ 
            sucesso: false, 
            error: error.message || 'Erro interno ao processar o pagamento.' 
        });
    }
};