<?php
// InsightBridge Global — Contact Form Handler
// Sends form submissions to tongyin@insightbridge.global

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://insightbridge.global');
header('Access-Control-Allow-Methods: POST');

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Collect and sanitize inputs
$name    = htmlspecialchars(strip_tags(trim($_POST['name'] ?? '')));
$email   = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$subject = htmlspecialchars(strip_tags(trim($_POST['subject'] ?? 'Contact Form Inquiry')));
$message = htmlspecialchars(strip_tags(trim($_POST['message'] ?? '')));

// Validate required fields
if (empty($name) || empty($email) || empty($message)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Please fill in all required fields.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
    exit;
}

// Destination
$to      = 'tongyin@insightbridge.global';
$subject_line = '[InsightBridge Contact] ' . ($subject ?: 'New Inquiry') . ' — from ' . $name;

// Plain text body
$body  = "New contact form submission — insightbridge.global\r\n";
$body .= "========================================================\r\n\r\n";
$body .= "Name:    " . $name . "\r\n";
$body .= "Email:   " . $email . "\r\n";
$body .= "Subject: " . $subject . "\r\n\r\n";
$body .= "Message:\r\n";
$body .= "--------\r\n";
$body .= $message . "\r\n\r\n";
$body .= "========================================================\r\n";
$body .= "Time: " . date('Y-m-d H:i:s T') . "\r\n";
$body .= "IP:   " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . "\r\n";

// Headers — use domain email as From to pass SPF/DKIM on Hostinger
$headers  = "From: InsightBridge Contact <noreply@insightbridge.global>\r\n";
$headers .= "Reply-To: " . $name . " <" . $email . ">\r\n";
$headers .= "Return-Path: noreply@insightbridge.global\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "Content-Transfer-Encoding: 8bit\r\n";

// Additional sendmail params to set envelope sender (helps avoid spam)
$additional_params = '-f noreply@insightbridge.global';

// Send
$sent = mail($to, $subject_line, $body, $headers, $additional_params);

if ($sent) {
    echo json_encode(['success' => true]);
} else {
    // Log failure for debugging
    error_log('[InsightBridge] mail() failed for ' . $email . ' at ' . date('Y-m-d H:i:s'));
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Mail server error. Please email tongyin@insightbridge.global directly.']);
}
?>
