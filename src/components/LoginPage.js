// components/LoginPage.js
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Link,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('email'); // 'email' or 'password'
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (step === 'email') {
      if (email.trim()) {
        // Proceed to the password step
        setStep('password');
      } else {
        alert('Please enter your email.');
      }
    } else if (step === 'password') {
      if (password) {
        // Fetch the user JSON file dynamically based on the email
        fetch(`/data/${email}.json`)
          .then((res) => {
            if (!res.ok) {
              throw new Error('User not found');
            }
            return res.json();
          })
          .then((data) => {
            if (data.password && data.password === password) {
              onLogin(email);
            } else {
              alert('Invalid email or password');
            }
          })
          .catch((error) => {
            alert('Login failed: ' + error.message);
            console.error(error);
          });
      } else {
        alert('Please enter your password.');
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundImage: 'url(/images/loginbg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={6}
        sx={{
          px: 4,
          pt: 12,  // Equal top padding
          pb: 12,  // Equal bottom padding
          maxWidth: 360,
          width: '100%',
          minHeight: 335,
          borderRadius: 2,
          textAlign: 'center',
        }}
      >
        {/* Logo with increased bottom margin for extra space */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
          <img
            src="/images/spacelinelogoblack.png"
            alt="Spaceline Logo"
            style={{ width: 250, height: 'auto' }} // Larger logo
          />
        </Box>

        {step === 'email' ? (
          <>
            <Typography variant="h4" gutterBottom>
              Welcome!
            </Typography>
            <Typography variant="body1" color="textSecondary" gutterBottom>
              Please sign in to Spaceline Labs to access your personalized account.
            </Typography>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                type="email"
                label="Email"
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button
                fullWidth
                variant="contained"
                color="primary"
                type="submit"
                sx={{
                  mt: 2,
                  py: 1.5,
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}
              >
                Next
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="h5" gutterBottom>
              Enter Your Password
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Enter your password for Spaceline Labs to continue to your account.
            </Typography>
            <Typography variant="subtitle1" sx={{ mt: 1, mb: 2 }}>
              {email}
            </Typography>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                label="Password"
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Link
                href="#"
                underline="hover"
                sx={{ display: 'block', mt: 1, textAlign: 'right' }}
              >
                Forgot Password?
              </Link>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                type="submit"
                sx={{
                  mt: 2,
                  py: 1.5,
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}
              >
                Login
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default LoginPage;
