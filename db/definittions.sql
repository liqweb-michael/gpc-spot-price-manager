CREATE TABLE sources (
    id int primary key,
    name text not null,
    description text default '',
    info jsonb not null default '{}'::jsonb
);


CREATE TABLE spot_prices_real_time (
    time timestamptz,
    symbol text,
    source int,
    bid numeric(12,6),
    ask numeric(12,6),
    mid numeric(12,6),
    id bigserial not null
);

SELECT create_hypertable('spot_prices_real_time', by_range('time', INTERVAL '1 day'));

ALTER TABLE spot_prices_real_time SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol'
);

SELECT add_compression_policy('spot_prices_real_time', INTERVAL '2 days');

CREATE INDEX ON spot_prices_real_time (symbol,source,time);

CREATE UNIQUE INDEX ON spot_prices_real_time (symbol,source,time);


insert into sources(id, name) values
(1, 'goldapi.io'),
(2, 'swissquote')


CREATE TABLE spot_prices_daily_stats (
    time timestamptz not null,
    symbol text not null,
    source int not null,
    open numeric(12,6) not null,
    open_time timestamptz not null,
    close numeric(12,6) default null,
    close_time timestamptz default null,
    high numeric(12,6) not null,
    low numeric(12,6) not null
);

SELECT create_hypertable('spot_prices_daily_stats', 'time', chunk_time_interval => INTERVAL '1 year');
ALTER TABLE spot_prices_daily_stats SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol'
);
SELECT add_compression_policy('spot_prices_daily_stats', INTERVAL '1 year');

CREATE INDEX ON spot_prices_daily_stats (symbol,source,time);





CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS TRIGGER as $update_daily_stats$
DECLARE
    rec RECORD;
    earliest_time TIMESTAMPTZ;
    latest_time TIMESTAMPTZ;
BEGIN
    -- Check if the daily stats record exists for the given time, symbol, and source
    SELECT *
    INTO rec
    FROM spot_prices_daily_stats
    WHERE time = DATE_TRUNC('day', NEW.time)
      AND symbol = NEW.symbol
      AND source = NEW.source;

    IF rec IS NULL THEN
        -- Insert a new record if it doesn't exist
        INSERT INTO spot_prices_daily_stats (
            time, symbol, source, open, open_time, high, low
        )
        VALUES (
            DATE_TRUNC('day', NEW.time), NEW.symbol, NEW.source, NEW.mid, NEW.time, NEW.mid, NEW.mid
        );
    ELSE
        -- Get the earliest time between NEW.time and rec.time
        earliest_time := LEAST(NEW.time, rec.time);
        latest_time := GREATEST(NEW.time, rec.time);

        -- Update the existing record with the new high, low, and close values
        UPDATE spot_prices_daily_stats
        SET 
            open_time = earliest_time,
            close_time = latest_time,
            high = GREATEST(rec.high, NEW.mid),
            low = LEAST(rec.low, NEW.mid)
        WHERE time = DATE_TRUNC('day', NEW.time)
          AND symbol = NEW.symbol
          AND source = NEW.source;
    END IF;

    RETURN NULL;
END;
$update_daily_stats$ LANGUAGE plpgsql;



-- Create the trigger
CREATE TRIGGER update_daily_stats_trigger
AFTER INSERT ON spot_prices_real_time
FOR EACH ROW
EXECUTE FUNCTION update_daily_stats();





select 
    sp.symbol, sp.time, sp.ask, sp.bid, sp.mid,
    d.open, d.high, d.low
from
    spot_prices_real_time sp
    left join spot_prices_daily_stats d
        on d.time = DATE_TRUNC('day', sp.time)
        and sp.symbol = d.symbol
        and sp.source = d.source
    left join sources s
        on s.id = sp.source
    where
        s.name = 'goldapi.io'
        and sp.symbol = 'XAU/USD'
order by sp.time desc
limit 1