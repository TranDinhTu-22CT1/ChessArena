import React from 'react';
import AuthPage from '../../components/AuthPage';

export default function RegisterPage(props) {
  return <AuthPage {...props} authMode="register" />;
}
