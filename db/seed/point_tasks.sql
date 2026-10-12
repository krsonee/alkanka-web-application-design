INSERT INTO point_tasks (title, description, reward, task_type, code, repeat_daily, active, sort_order) VALUES
('Günlük giriş', 'Bugün siteye giriş yap. Günlük puan girişte yazılır; bu görevin puanını ayrıca toplarsın.', 25, 'daily_login', '', true, true, 1),
('Bir siteye git', 'Listedeki herhangi bir siteye AL KANKA üzerinden gir, sonra puanı topla.', 25, 'visit_site', '', false, true, 2),
('Telegram hesabını bağla', 'Profilinden Telegram hesabını bağla.', 50, 'connect_telegram', '', false, true, 3),
('Telegram kanalına katıl', 'Kanala katıl, profilinden doğrula, sonra puanı topla.', 100, 'join_telegram', '', false, true, 4),
('Kodu gir', 'Paylaşılan kodu yaz.', 50, 'enter_code', 'ALKANKA', false, true, 5);
