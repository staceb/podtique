//
//  GPIO.h
//  Podtique
//
//  Created by Roderick Mann on 12/28/14.
//  Copyright (c) 2015 Latency: Zero, LLC. All rights reserved.
//

#ifndef __Podtique__GPIO__
#define __Podtique__GPIO__


#include <stdint.h>
#include <string>


class
GPIO
{
public:
						GPIO();
	
						/**
							You can set the GPIO number once. Another attempt will assert.
						*/
	
	void				setGPIONumber(uint16_t inNumber);
	
	void				setInput();
	void				setOutput();
	bool				get() const;
	void				set(bool inVal);
	
protected:
	void				exportGPIO();
	
	void				write(const std::string& inDir, const std::string& inFile, const std::string& inVal) const;
	void				write(const std::string& inDir, const std::string& inFile, uint16_t inVal) const;
	std::string			read(const std::string& inDir, const std::string& inFile) const;
	
private:
	uint16_t			mNumber;
	std::string			mPath;
	
	
	static	std::string	sGPIOPath;
};

#endif /* defined(__Podtique__GPIO__) */
