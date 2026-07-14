-- This query must return zero rows before/after deploying resilient payments.
WITH violations AS (
  SELECT 'duplicate_provider_request' AS kind, provider_request_id AS entity
  FROM payment_transactions GROUP BY provider_request_id HAVING count(*) > 1
  UNION ALL
  SELECT 'paid_order_without_success', o.id::text
  FROM orders o
  WHERE o.status = 'PAID' AND NOT EXISTS (
    SELECT 1 FROM payment_transactions p
    WHERE p.order_id = o.id AND p.status = 'SUCCESS'
  )
  UNION ALL
  SELECT 'invalid_ticket_type_counters', id::text
  FROM ticket_types
  WHERE reserved_quantity < 0 OR sold_quantity < 0
     OR reserved_quantity + sold_quantity > total_quantity
  UNION ALL
  SELECT 'paid_order_ticket_count_mismatch', o.id::text
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN tickets t ON t.order_item_id = oi.id
  WHERE o.status = 'PAID'
  GROUP BY o.id, oi.id, oi.quantity
  HAVING count(t.id) <> oi.quantity
)
SELECT * FROM violations ORDER BY kind, entity;
