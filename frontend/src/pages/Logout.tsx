import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const Logout: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto redirect to login after 5 seconds
    const timer = setTimeout(() => {
      navigate('/login');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-muted flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <CheckCircle className="h-16 w-16 text-primary" />
        </div>
        <h2 className="text-center text-3xl font-bold text-foreground">
          Successfully Logged Out
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          You have been logged out from all sessions
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-8">
          <div className="text-center space-y-6">
            <p className="text-foreground">
              Your session has been terminated and you've been logged out from the identity provider.
            </p>

            <div className="pt-4">
              <Button
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Return to Login
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Redirecting to login in 5 seconds...
            </p>
          </div>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            AI Gateway & Registry - Secure Access Management
          </p>
        </div>
      </div>
    </div>
  );
};

export default Logout;
