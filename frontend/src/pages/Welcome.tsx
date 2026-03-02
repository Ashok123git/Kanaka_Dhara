import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWholesaler } from '@/lib/storage';
import { Package } from 'lucide-react';

const Welcome = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already registered
    const timer = setTimeout(() => {
      const wholesaler = getWholesaler();
      if (wholesaler) {
        navigate('/home', { replace: true });
      } else {
        setIsLoading(false);
      }
    }, 1500); // Show splash for 1.5 seconds

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleGetStarted = () => {
    navigate('/register');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary">
      <div className="flex flex-col items-center space-y-8 p-8 text-center">
        {/* Logo */}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-foreground/10">
          <Package className="h-14 w-14 text-primary-foreground" />
        </div>

        {/* App Name */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-primary-foreground">
            Kanaka Dhara
          </h1>
          <p className="text-primary-foreground/80">
            Track your textile business, effortlessly
          </p>
        </div>

        {/* Loading or Get Started */}
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-foreground/60 [animation-delay:-0.3s]"></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-foreground/60 [animation-delay:-0.15s]"></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary-foreground/60"></div>
          </div>
        ) : (
          <button
            onClick={handleGetStarted}
            className="mt-8 rounded-full bg-primary-foreground px-8 py-3 font-semibold text-primary transition-transform hover:scale-105 active:scale-95"
          >
            Get Started
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center text-sm text-primary-foreground/60">
        <p>Made for Indian Wholesalers</p>
      </div>
    </div>
  );
};

export { Welcome };
