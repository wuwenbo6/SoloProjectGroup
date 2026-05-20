USE fittrack;

INSERT INTO exercise_templates (name, description, exercise_type, difficulty_level, correction_tips, created_at, is_active) VALUES
('Squat Standard', 'Standard bodyweight squat exercise for lower body strength', 'STRENGTH', 1, 'Keep your back straight; Knees should track over toes; Chest up', NOW(), 1),
('Push-up Standard', 'Standard push-up for upper body strength', 'STRENGTH', 2, 'Keep your body in a straight line; Elbows at 45 degrees; Full range of motion', NOW(), 1);

SET @squat_id = LAST_INSERT_ID();

INSERT INTO template_frames (exercise_template_id, frame_order, keypoints_json, angles_json) VALUES
(@squat_id, 1, '{}', '{"left_elbow":180,"right_elbow":180,"left_knee":180,"right_knee":180,"left_shoulder":90,"right_shoulder":90,"left_hip":180,"right_hip":180}'),
(@squat_id, 2, '{}', '{"left_elbow":180,"right_elbow":180,"left_knee":135,"right_knee":135,"left_shoulder":90,"right_shoulder":90,"left_hip":135,"right_hip":135}'),
(@squat_id, 3, '{}', '{"left_elbow":180,"right_elbow":180,"left_knee":90,"right_knee":90,"left_shoulder":90,"right_shoulder":90,"left_hip":90,"right_hip":90}'),
(@squat_id, 4, '{}', '{"left_elbow":180,"right_elbow":180,"left_knee":135,"right_knee":135,"left_shoulder":90,"right_shoulder":90,"left_hip":135,"right_hip":135}'),
(@squat_id, 5, '{}', '{"left_elbow":180,"right_elbow":180,"left_knee":180,"right_knee":180,"left_shoulder":90,"right_shoulder":90,"left_hip":180,"right_hip":180}');

SET @pushup_id = LAST_INSERT_ID();

INSERT INTO template_frames (exercise_template_id, frame_order, keypoints_json, angles_json) VALUES
(@pushup_id, 1, '{}', '{"left_elbow":180,"right_elbow":180,"left_knee":180,"right_knee":180,"left_shoulder":45,"right_shoulder":45,"left_hip":180,"right_hip":180}'),
(@pushup_id, 2, '{}', '{"left_elbow":135,"right_elbow":135,"left_knee":180,"right_knee":180,"left_shoulder":90,"right_shoulder":90,"left_hip":180,"right_hip":180}'),
(@pushup_id, 3, '{}', '{"left_elbow":90,"right_elbow":90,"left_knee":180,"right_knee":180,"left_shoulder":135,"right_shoulder":135,"left_hip":180,"right_hip":180}'),
(@pushup_id, 4, '{}', '{"left_elbow":135,"right_elbow":135,"left_knee":180,"right_knee":180,"left_shoulder":90,"right_shoulder":90,"left_hip":180,"right_hip":180}'),
(@pushup_id, 5, '{}', '{"left_elbow":180,"right_elbow":180,"left_knee":180,"right_knee":180,"left_shoulder":45,"right_shoulder":45,"left_hip":180,"right_hip":180}');

INSERT INTO users (username, email, password, created_at, is_active) VALUES
('demo_user', 'demo@example.com', 'demo123', NOW(), 1);
