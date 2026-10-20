-- ─────────────────────────────────────────────────────────────────────────────
-- Ticketing System Schema
-- ─────────────────────────────────────────────────────────────────────────────

-- Events table: each row represents a ticketed event
CREATE TABLE IF NOT EXISTS events (
  id             INT          NOT NULL AUTO_INCREMENT,
  name           VARCHAR(255) NOT NULL,
  total_tickets  INT          NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tickets table: one row per individual ticket seat
-- status  : lifecycle state of the ticket
-- user_id : set when a ticket is locked or paid (nullable until claimed)
-- version : optimistic locking counter — increment on every state change
CREATE TABLE IF NOT EXISTS tickets (
  id        INT                                   NOT NULL AUTO_INCREMENT,
  event_id  INT                                   NOT NULL,
  status    ENUM('AVAILABLE', 'LOCKED', 'PAID')   NOT NULL DEFAULT 'AVAILABLE',
  user_id   VARCHAR(255)                          NULL,
  version   INT                                   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_tickets_event
    FOREIGN KEY (event_id) REFERENCES events (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX idx_tickets_event_status (event_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
