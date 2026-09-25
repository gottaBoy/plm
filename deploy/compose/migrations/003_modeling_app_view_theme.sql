-- Modeling runtime uses the shared ibizapi database for system entities.
-- Target database: ibizapi, MySQL 5.7.

CREATE TABLE IF NOT EXISTS `APP_VIEW_THEME` (
  `ID` varchar(100) NOT NULL,
  `NAME` varchar(200) DEFAULT NULL,
  `CAPTION` varchar(200) DEFAULT NULL,
  `APP_TAG` varchar(100) DEFAULT NULL,
  `APP_VIEW_TAG` varchar(100) DEFAULT NULL,
  `SYSTEM_TAG` varchar(100) DEFAULT NULL,
  `OWNER_TYPE` varchar(30) DEFAULT NULL,
  `THEME_MODEL` mediumtext,
  `ORDER_VALUE` int(11) DEFAULT NULL,
  `VALID_FLAG` int(11) DEFAULT NULL,
  `CREATE_MAN` varchar(100) DEFAULT NULL,
  `CREATE_TIME` datetime DEFAULT NULL,
  `UPDATE_MAN` varchar(100) DEFAULT NULL,
  `UPDATE_TIME` datetime DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应用视图主题';
