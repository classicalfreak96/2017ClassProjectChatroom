<?php
																//if login worked
	ini_set("session.cookie_httponly", 1);
	session_start();															//start session
	$_SESSION['username'] = $_POST['username'];									//assign passed in username to session variable 
	$_SESSION['token'] = substr(md5(rand()), 0, 10);							//generate sesion token

	exit;
	
?>