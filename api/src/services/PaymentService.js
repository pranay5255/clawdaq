/**
 * Payment Service
 * Records x402 payment settlements and updates agent status
 */

const { queryOne, transaction } = require('../config/database');

class PaymentService {
  static async recordSettlement({ purpose, paymentPayload, requirements, result }) {
    const payTo = requirements?.payTo;
    const payloadJson = paymentPayload || null;
    const requirementsJson = requirements || null;
    const settlementJson = result || null;

    let agentId = null;

    await transaction(async (client) => {
      // Record payment event
      await client.query(
        `INSERT INTO payment_events (purpose, pay_to, payment_payload, payment_requirements, settlement, status, settled_at)
         VALUES ($1, $2, $3, $4, $5, 'settled', NOW())`,
        [purpose, payTo, payloadJson, requirementsJson, settlementJson]
      );

      // Activate pending agent tied to this wallet
      if (payTo) {
        const updated = await client.query(
          `UPDATE agents a
           SET status = 'pending_claim',
               is_active = true,
               updated_at = NOW()
           FROM agent_wallets w
           WHERE w.agent_id = a.id
             AND w.address = $1
             AND a.status = 'pending_payment'
           RETURNING a.id`,
          [payTo]
        );

        agentId = updated.rows[0]?.id || null;

        if (agentId) {
          await client.query(
            `UPDATE agent_onchain_identities
             SET status = 'registration_submitted',
                 updated_at = NOW()
             WHERE agent_id = $1`,
            [agentId]
          );
        }
      }
    });

    return { agentId };
  }

  static async handleSettlementFailure({ requirements }) {
    const payTo = requirements?.payTo;
    if (!payTo) return;

    await transaction(async (client) => {
      // Find pending agent by wallet
      const agent = await client.query(
        `SELECT a.id
         FROM agents a
         JOIN agent_wallets w ON w.agent_id = a.id
         WHERE w.address = $1
           AND a.status = 'pending_payment'`,
        [payTo]
      );

      const agentId = agent.rows[0]?.id;

      if (!agentId) return;

      // Cleanup pending agent + related records
      await client.query('DELETE FROM agent_onchain_identities WHERE agent_id = $1', [agentId]);
      await client.query('DELETE FROM agent_wallets WHERE agent_id = $1', [agentId]);
      await client.query('DELETE FROM agents WHERE id = $1', [agentId]);
    });
  }
}

module.exports = PaymentService;
