-- All existing billing customers are billed for ChargeMOD charging sessions (New Bill
-- suggestions use this). Applied live 2026-10-21.
update public.billing_customers set session_source = 'chargemod' where session_source is null;
