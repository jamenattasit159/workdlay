<?php
// Mock parameters
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET['years_month'] = '2026-01';
$_GET['department'] = 'all';

// Include the target file
include 'kpi_report.php';
?>