
"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from '@/lib/utils';
import { Star, Play, RefreshCw, X, ChevronLeft, Lock, Unlock } from 'lucide-react';

const ShuttleIcon = () => (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g>
            <path d="M14 26C14 28.2091 15.7909 30 18 30C20.2091 30 22 28.2091 22 26C22 23.7909 20.2091 22 18 22C15.7909 22 14 23.7909 14 26Z" fill="#D2B48C"/>
            <path d="M22 26C22 23.7909 20.2091 22 18 22C15.7909 22 14 23.7909 14 26" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 26H22" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14.5 24.5H21.5" stroke="#E53B3B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M15 22L4 6H8L17 22" fill="#F0F0F0" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 22L32 6H28L19 22" fill="#F0F0F0" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M17 22L12 6H18L18 22Z" fill="#F0F0F0" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 22L24 6H18L18 22Z" fill="#F0F0F0" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18 22L18 6" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
    </svg>
);


const GAME_WIDTH = 500;
const GAME_HEIGHT = 300;
const NET_HEIGHT = 80;
const SHUTTLE_START_Y = 20;
const SHUTTLES_PER_GAME = 10;
const UNLOCK_SCORE_THRESHOLD = 20; // Score needed to unlock next level
const HIGHEST_UNLOCKED_LEVEL_KEY = 'shuttleKillHighestLevel';

// Speeds are calibrated based on 60fps, GAME_WIDTH/2 is the net.
// Speed = (GAME_WIDTH / 2) / (seconds * 60fps)
const difficultyLevels = [
    { id: 2, name: "Backyard Player", speed: 2.1, pointsMultiplier: 1 },        // ~2.0 seconds to net
    { id: 3, name: "Club Contender", speed: 2.8, pointsMultiplier: 1.5 },       // ~1.5 seconds to net
    { id: 4, name: "Regional Champ", speed: 4.2, pointsMultiplier: 2 },        // ~1.0 second to net
    { id: 5, name: "Badminton Pro", speed: 8.4, pointsMultiplier: 2.5 },         // ~0.5 seconds to net
];


const ShuttleKillGame = () => {
  const { toast } = useToast();
  const { user, updateUserPoints } = useAuth();
  const [gameState, setGameState] = useState<'levelSelection' | 'running' | 'gameover'>('levelSelection');
  const [isGameOverHandled, setIsGameOverHandled] = useState(false);
  const [score, setScore] = useState(0);
  const [shuttlesLeft, setShuttlesLeft] = useState(SHUTTLES_PER_GAME);
  const [shuttle, setShuttle] = useState({ x: 0, y: SHUTTLE_START_Y, speedX: 0, speedY: 0, rotation: -90 });
  const [message, setMessage] = useState<{ text: string; color: string; key: number } | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState(2);
  const [unlockedLevel, setUnlockedLevel] = useState(2);

  const gameLoopRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  
  const shuttlesLeftRef = useRef(shuttlesLeft);
  useEffect(() => {
    shuttlesLeftRef.current = shuttlesLeft;
  }, [shuttlesLeft]);
  
  useEffect(() => {
    const savedLevel = localStorage.getItem(HIGHEST_UNLOCKED_LEVEL_KEY);
    if (savedLevel) {
      setUnlockedLevel(parseInt(savedLevel, 10));
    }
  }, []);

  const resetShuttle = useCallback((speed: number) => {
    setShuttle({
      x: 0,
      y: SHUTTLE_START_Y,
      speedX: speed,
      speedY: 0,
      rotation: -90, // Point right
    });
  }, []);

  const startGame = (levelId: number) => {
    const level = difficultyLevels.find(l => l.id === levelId);
    if (!level) return;

    setSelectedLevelId(levelId);
    setScore(0);
    setShuttlesLeft(SHUTTLES_PER_GAME);
    setGameState('running');
    setIsGameOverHandled(false);
    resetShuttle(level.speed);
  };

  const showMessage = (text: string, color: string) => {
    setMessage({ text, color, key: Date.now() });
    setTimeout(() => setMessage(null), 1000);
  };
  
  const endShuttleAttempt = useCallback(() => {
    if (shuttlesLeftRef.current <= 1) {
        setGameState('gameover');
        setShuttlesLeft(0);
        return; 
    }

    setShuttlesLeft(prev => prev - 1);
    const level = difficultyLevels.find(l => l.id === selectedLevelId);
    if (level) {
      resetShuttle(level.speed);
    }
  }, [selectedLevelId, resetShuttle]);


  const handleSmash = () => {
    if (gameState !== 'running') return;
    
    const killZoneStart = GAME_WIDTH / 2;
    const killZoneEnd = GAME_WIDTH / 2 + 60;

    if (shuttle.x < killZoneStart) {
      showMessage("FAULT!", "text-red-500");
    } else if (shuttle.x >= killZoneStart && shuttle.x <= killZoneEnd) {
      const level = difficultyLevels.find(l => l.id === selectedLevelId);
      if (!level) return;

      const distanceIntoZone = shuttle.x - killZoneStart;
      const percentageIntoZone = distanceIntoZone / (killZoneEnd - killZoneStart);
      
      let basePoints = 0;
      if (percentageIntoZone <= 0.2) basePoints = 5;
      else if (percentageIntoZone <= 0.6) basePoints = 3;
      else basePoints = 1;
      
      const pointsEarned = Math.round(basePoints * level.pointsMultiplier);

      if (pointsEarned > 0) {
        setScore(prev => prev + pointsEarned);
        showMessage(`+${pointsEarned} XP!`, "text-yellow-400");
      } else {
         showMessage("PERFECT!", "text-green-400");
      }
    } else { // shuttle.x is past the kill zone
        showMessage("LATE!", "text-red-500");
    }
    
    endShuttleAttempt();
  };

  const gameLoop = useCallback((time: number) => {
    if (lastTimeRef.current != null) {
      setShuttle(prev => {
        if (gameState !== 'running' || shuttlesLeftRef.current <= 0) {
           if (shuttlesLeftRef.current <= 0 && gameState === 'running') {
                setGameState('gameover');
           }
           return prev;
        }

        const gravity = prev.x < GAME_WIDTH / 2 ? 0.02 : 0.12;
        let newSpeedY = prev.speedY + gravity;
        
        let newRotation;
        const netPositionX = GAME_WIDTH / 2;
        const rotationCompletionX = GAME_WIDTH * 0.75;

        if (prev.x < netPositionX) {
            newRotation = -90; // Pointing right
        } else if (prev.x >= netPositionX && prev.x <= rotationCompletionX) {
            // Gradually rotate from -90 to 0 (pointing down)
            const progress = (prev.x - netPositionX) / (rotationCompletionX - netPositionX);
            newRotation = -90 + (90 * progress);
        } else {
            newRotation = 0; // Pointing down
        }
       
        const newX = prev.x + prev.speedX;
        const newY = prev.y + newSpeedY;

        if (newY > GAME_HEIGHT - 15 || newX > GAME_WIDTH) {
          if (newY > GAME_HEIGHT - 15) {
            showMessage("MISS!", "text-gray-400");
          }
          endShuttleAttempt();
          return prev; 
        }
        
        return { ...prev, x: newX, y: newY, speedY: newSpeedY, rotation: newRotation };
      });
    }
    lastTimeRef.current = time;
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, endShuttleAttempt]);

  useEffect(() => {
    if (gameState === 'running') {
      lastTimeRef.current = undefined;
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  useEffect(() => {
    if (gameState === 'gameover' && !isGameOverHandled) {
      setIsGameOverHandled(true);
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      if (score > 0) {
        updateUserPoints(score);
        toast({
          title: "Game Over!",
          description: `You earned ${score} XP from Shuttle Kill!`,
        });
      }
      const level = difficultyLevels.find(l => l.id === selectedLevelId);
      const unlockedDifficultyLevel = difficultyLevels.find(l => l.id === unlockedLevel);
      if (level && unlockedDifficultyLevel && level.id === unlockedLevel && score >= UNLOCK_SCORE_THRESHOLD && unlockedLevel < difficultyLevels[difficultyLevels.length - 1].id) {
          const currentIndex = difficultyLevels.findIndex(l => l.id === unlockedLevel);
          const newUnlockedLevel = difficultyLevels[currentIndex + 1];
          if(newUnlockedLevel) {
            setUnlockedLevel(newUnlockedLevel.id);
            localStorage.setItem(HIGHEST_UNLOCKED_LEVEL_KEY, newUnlockedLevel.id.toString());
            toast({
                title: "Level Unlocked!",
                description: `You've unlocked "${newUnlockedLevel.name}"!`,
                variant: "default",
            });
          }
      }
    }
  }, [gameState, isGameOverHandled, score, updateUserPoints, toast, selectedLevelId, unlockedLevel]);

  return (
    <Card className="max-w-xl mx-auto shadow-2xl bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-primary flex items-center">
          <Star className="h-8 w-8 mr-3 text-accent" /> Shuttle Kill Mini-Game
        </CardTitle>
        <CardDescription>Click to smash the shuttle over the net. Timing is everything!</CardDescription>
      </CardHeader>
      <CardContent>
         {gameState !== 'levelSelection' && (
            <div className="flex justify-between items-center mb-4 p-4 bg-background rounded-lg shadow-inner">
                <div className="text-2xl font-bold text-primary">Score: <span className="text-accent">{score}</span></div>
                <div className="text-2xl font-bold text-primary">Shuttles: <span className="text-accent">{shuttlesLeft}</span></div>
            </div>
         )}

        <div 
          className="relative w-full h-[300px] bg-blue-900/50 rounded-lg overflow-hidden border-4 border-primary/50 cursor-pointer shadow-lg"
          onClick={gameState === 'running' ? handleSmash : undefined}
          style={{ width: `${GAME_WIDTH}px`, height: `${GAME_HEIGHT}px` }}
        >
          {/* Net */}
          <div className="absolute bottom-0 h-[80px] w-2 bg-white left-1/2 -translate-x-1/2" />
          <div className="absolute left-1/2 top-0 h-full w-[1px] bg-white/30" />
          <div className="absolute bottom-[80px] left-1/2 w-[100px] h-1 bg-white -translate-x-1/2" />
          
          <AnimatePresence>
            {message && (
              <motion.div
                key={message.key}
                initial={{ opacity: 0, scale: 0.5, y: 0 }}
                animate={{ opacity: 1, scale: 1.2, y: -30 }}
                exit={{ opacity: 0, scale: 0.5, y: -60 }}
                transition={{ duration: 0.5, type: 'spring' }}
                className={cn("absolute text-4xl font-black text-center w-full top-1/3", message.color)}
              >
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          {gameState === 'running' && shuttlesLeft > 0 && (
            <motion.div
              className="absolute"
              style={{
                left: shuttle.x,
                top: shuttle.y,
              }}
              animate={{
                left: shuttle.x,
                top: shuttle.y,
                rotate: shuttle.rotation,
              }}
              transition={{ duration: 0, ease: "linear" }}
            >
              <ShuttleIcon />
            </motion.div>
          )}

          {gameState === 'levelSelection' && (
             <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-10 p-6">
                <h3 className="text-3xl font-bold mb-4">Select Difficulty</h3>
                <div className="w-full space-y-2">
                    {difficultyLevels.map(level => {
                        const isLocked = level.id > unlockedLevel;
                        return (
                            <Button 
                                key={level.id}
                                onClick={() => startGame(level.id)}
                                className="w-full justify-between btn-game text-lg py-3"
                                variant={isLocked ? "outline" : "default"}
                                disabled={isLocked}
                            >
                                <span>{level.name}</span>
                                {isLocked ? <Lock className="h-5 w-5"/> : <Unlock className="h-5 w-5"/>}
                            </Button>
                        )
                    })}
                </div>
            </div>
          )}
          {gameState === 'gameover' && (
             <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-10 p-6">
                <Button onClick={() => setGameState('levelSelection')} variant="ghost" className="absolute top-2 right-2 text-white hover:text-white hover:bg-white/20 h-8 w-8 p-0 rounded-full">
                    <X className="h-5 w-5"/>
                    <span className="sr-only">Close</span>
                </Button>
                <h3 className="text-4xl font-bold">Game Over</h3>
                <p className="text-2xl mt-2 mb-4">Final Score: <span className="text-accent font-bold">{score}</span></p>
                <div className="flex gap-4">
                    <Button onClick={() => setGameState('levelSelection')} className="btn-game-accent text-lg py-2.5 px-5">
                        <ChevronLeft className="mr-2 h-5 w-5"/> Levels
                    </Button>
                    <Button onClick={() => startGame(selectedLevelId)} className="btn-game-accent text-lg py-2.5 px-5">
                        <RefreshCw className="mr-2 h-5 w-5"/> Play Again
                    </Button>
                </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ShuttleKillGame;
