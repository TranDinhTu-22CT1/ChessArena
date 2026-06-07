import React from 'react';
import AuthPage from '../../components/AuthPage';

export default function ForgotPasswordPage(props) {
  return <AuthPage {...props} authMode="forgot" />;
}
