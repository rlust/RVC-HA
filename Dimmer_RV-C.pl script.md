# Parameters

<load-id> (Required):

A number between 1 and 99.

Identifies the specific dimmer/light load to control.

You need to check files named like *.dc_loads.txt to find the correct ID for a specific light.

<command> (Required):

A numeric code representing the action to perform. See the list below.

{brightness} (Optional):

A number between 0 and 100 (representing percentage).

Used with commands like "Set Level" (Command 0).

{time} (Optional):

A number between 0 and 240 (representing seconds).

Used with commands involving duration or delay (e.g., On (Duration), On (Delay), Off (Delay)).

Usage: 
	dimmer_RV-C.pl <load-id> <command> {brightness} {time}

	<load-id> is required and one of:
		 {1..99} (check the *.dc_loads.txt files for a list)

	<command> is required and one of:
		0 = Set Level(delay)
		1 = On (Duration)
		2 = On (Delay)
		3 = Off (Delay)
		5 = Toggle
		6 = Memory Off
		17 = Ramp Brightness
		18 = Ramp Toggle
		19 = Ramp Up
		20 = Ramp Down
		21 = Ramp Down/Up

	{brightness}	- 0 to 100 (percentage)	- Optional
	{time}		- 0 to 240 (seconds)	- Optional

      values:
        0: set brightness
        1: on duration
        2: on delay
        3: off
        4: stop
        5: toggle
        6: memory off
        17: ramp brightness
        18: ramp toggle
        19: ramp up
        20: ramp down
        21: ramp up/down
        33: lock
        34: unlock
        49: flash
        50: flash momentarily
In summary, the text describes how to use the dimmer_RV-C.pl script to send various commands (like on, off, set brightness, ramp, flash) to specific RV-C dimmer loads using their numeric IDs and corresponding command codes.
s
