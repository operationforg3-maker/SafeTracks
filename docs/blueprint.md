# **App Name**: SafeTracks

## Core Features:

- Real-time Train Tracking: Display current positions, speeds, and movement vectors of trains, sourced from the PKP PLK API.
- Proximity Alerts: Provide critical alerts when users approach railway tracks, considering train positions and speeds; uses precise GPS monitoring within 200m of tracks and Cell-ID monitoring otherwise, with alerts that bypass mute settings.
- Crowdsourced Hazard Reporting: Allow users to report unofficial crossings and obstacles, improving overall safety data.
- ETA Prediction: Estimate train arrival times at specific GPS points, using an algorithm to compensate for API delays; displays a dynamic, time-windowed list of approaching trains.
- Predictive Positioning Tool: Employ an AI-driven engine to calculate train positions between API updates, enhancing accuracy; positions displayed will account for last known position plus speed multiplied by time since last update, reducing lag.
- SOS Module: Enable quick generation of precise coordinates and nearest train data for emergency services (112/PLK).
- Enthusiast Mode: Offer train enthusiasts detailed data on routes, train numbers, and rolling stock types.

## Style Guidelines:

- Primary color: A deep navy blue (#2E3148) evoking trust and security, nodding to the professional use case.
- Background color: Light gray (#E7E8EA), a desaturated hue close to the primary, provides a clean and calming backdrop.
- Accent color: A vivid amber (#FFB300), a different hue than the primary to ensure good contrast. Signifies alerts or time-sensitive info.
- Headline font: 'Space Grotesk' (sans-serif) for headlines; Body font: 'Inter' (sans-serif) for body text.
- Use clear, universally recognized icons for train types, hazard warnings, and other key functions.
- Split-screen: Interactive map (top) with train visualizations, geofenced zones; Dashboard (bottom): Train list, time-window filtering.
- Smooth transitions for train movements on the map, with subtle animations for data updates.